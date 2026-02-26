-- ============================================================
-- Daily Standup Tasks — Full Schema
-- Tables: standup_meetings, daily_standup_tasks, team_member_aliases, task_pin_log
-- ============================================================

-- 1. Standup Meetings — tracks each processed daily standup
CREATE TABLE IF NOT EXISTS standup_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fireflies_transcript_id text NOT NULL UNIQUE,
  meeting_title text,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  meeting_duration_minutes integer,
  transcript_url text,
  tasks_extracted integer DEFAULT 0,
  tasks_unassigned integer DEFAULT 0,
  extraction_confidence_avg numeric(5,2),
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 2. Daily Standup Tasks — the core task table
CREATE TABLE IF NOT EXISTS daily_standup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES profiles(id),
  task_type text NOT NULL DEFAULT 'other'
    CHECK (task_type IN (
      'contact_owner', 'build_buyer_universe', 'follow_up_with_buyer',
      'send_materials', 'update_pipeline', 'schedule_call', 'other'
    )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'overdue')),
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id),
  source_meeting_id uuid REFERENCES standup_meetings(id),
  source_timestamp text,
  deal_reference text,
  deal_id uuid REFERENCES deals(id),

  -- Priority scoring fields
  priority_score numeric(6,2) DEFAULT 50,
  priority_rank integer,
  is_pinned boolean DEFAULT false,
  pinned_rank integer,
  pinned_by uuid REFERENCES profiles(id),
  pinned_at timestamptz,
  pin_reason text,

  -- Extraction metadata
  extraction_confidence text DEFAULT 'high'
    CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  needs_review boolean DEFAULT false,
  is_manual boolean DEFAULT false,

  updated_at timestamptz DEFAULT now()
);

-- 3. Team Member Aliases — maps Fireflies speaker names to profiles
CREATE TABLE IF NOT EXISTS team_member_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE (profile_id, alias)
);

-- 4. Task Pin Log — audit log for priority overrides
CREATE TABLE IF NOT EXISTS task_pin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES daily_standup_tasks(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('pinned', 'unpinned')),
  pinned_rank integer,
  reason text,
  performed_by uuid NOT NULL REFERENCES profiles(id),
  performed_at timestamptz DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_standup_tasks_assignee ON daily_standup_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_standup_tasks_status ON daily_standup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_standup_tasks_due_date ON daily_standup_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_standup_tasks_meeting ON daily_standup_tasks(source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_standup_tasks_deal ON daily_standup_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_standup_tasks_rank ON daily_standup_tasks(priority_rank);
CREATE INDEX IF NOT EXISTS idx_standup_meetings_date ON standup_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_team_member_aliases_alias ON team_member_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_task_pin_log_task ON task_pin_log(task_id);

-- ============================================================
-- Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_daily_standup_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_standup_tasks_updated_at
  BEFORE UPDATE ON daily_standup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_standup_tasks_updated_at();

-- ============================================================
-- Auto-mark overdue tasks (run via cron or check at query time)
-- ============================================================

CREATE OR REPLACE FUNCTION mark_overdue_standup_tasks()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE daily_standup_tasks
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE standup_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_standup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_pin_log ENABLE ROW LEVEL SECURITY;

-- Admin team (owner, admin, moderator) can read/write everything
CREATE POLICY "admin_all_standup_meetings"
  ON standup_meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "admin_all_standup_tasks"
  ON daily_standup_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "admin_all_team_member_aliases"
  ON team_member_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "admin_all_task_pin_log"
  ON task_pin_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "service_role_standup_meetings"
  ON standup_meetings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_standup_tasks"
  ON daily_standup_tasks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_team_aliases"
  ON team_member_aliases FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_pin_log"
  ON task_pin_log FOR ALL
  USING (auth.role() = 'service_role');
