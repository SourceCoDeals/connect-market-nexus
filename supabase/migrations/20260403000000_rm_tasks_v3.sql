-- ============================================================
-- AI Task Management System — v3.0 Schema
-- Tables: rm_tasks, rm_deal_team
-- Triggers: updated_at, deal lifecycle hooks
-- ============================================================

-- 1. rm_deal_team — Deal Team Membership
CREATE TABLE IF NOT EXISTS rm_deal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'support' CHECK (role IN ('lead', 'analyst', 'support')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (deal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_deal_team_deal ON rm_deal_team(deal_id);
CREATE INDEX IF NOT EXISTS idx_rm_deal_team_user ON rm_deal_team(user_id);

-- 2. rm_tasks — Core Tasks Table
CREATE TABLE IF NOT EXISTS rm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) <= 200),
  entity_type text NOT NULL CHECK (entity_type IN ('deal', 'buyer', 'contact')),
  entity_id uuid NOT NULL,
  secondary_entity_type text CHECK (secondary_entity_type IN ('deal', 'buyer', 'contact')),
  secondary_entity_id uuid,
  due_date date,
  expires_at timestamptz,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  deal_team_visible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'snoozed', 'cancelled', 'deal_closed')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'chatbot', 'system', 'template')),
  notes text,
  completion_notes text,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  completion_transcript_id text,
  ai_evidence_quote text,
  ai_relevance_score integer,
  ai_confidence text CHECK (ai_confidence IN ('high', 'medium')),
  ai_speaker_assigned_to text CHECK (ai_speaker_assigned_to IN ('advisor', 'seller', 'buyer')),
  transcript_id text,
  confirmed_at timestamptz,
  dismissed_at timestamptz,
  snoozed_until date,
  depends_on uuid REFERENCES rm_tasks(id),
  buyer_deal_score integer,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Enforce due_date for non-AI sources
  CONSTRAINT rm_tasks_due_date_required CHECK (
    source = 'ai' OR due_date IS NOT NULL
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rm_tasks_owner ON rm_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_rm_tasks_entity ON rm_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rm_tasks_secondary_entity ON rm_tasks(secondary_entity_type, secondary_entity_id) WHERE secondary_entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rm_tasks_status ON rm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_rm_tasks_due_date ON rm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_rm_tasks_source ON rm_tasks(source);
CREATE INDEX IF NOT EXISTS idx_rm_tasks_depends_on ON rm_tasks(depends_on) WHERE depends_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rm_tasks_expires_at ON rm_tasks(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rm_tasks_transcript ON rm_tasks(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rm_tasks_snoozed ON rm_tasks(snoozed_until) WHERE status = 'snoozed';

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_rm_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rm_tasks_updated_at
  BEFORE UPDATE ON rm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_rm_tasks_updated_at();

-- 4. Deal lifecycle hooks — trigger on listings status change
CREATE OR REPLACE FUNCTION rm_tasks_deal_lifecycle_hook()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Deal closed/sold → mark tasks as deal_closed
    IF NEW.status IN ('closed', 'sold') THEN
      UPDATE rm_tasks
      SET status = 'deal_closed', updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;

    -- Deal withdrawn/dead → cancel tasks
    IF NEW.status IN ('withdrawn', 'dead') THEN
      UPDATE rm_tasks
      SET status = 'cancelled', updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;

    -- Deal on hold → snooze tasks for 30 days
    IF NEW.status = 'on_hold' THEN
      UPDATE rm_tasks
      SET status = 'snoozed',
          snoozed_until = (CURRENT_DATE + INTERVAL '30 days')::date,
          updated_at = now()
      WHERE entity_type = 'deal'
        AND entity_id = NEW.id
        AND status IN ('open', 'in_progress');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rm_tasks_deal_lifecycle'
  ) THEN
    CREATE TRIGGER trg_rm_tasks_deal_lifecycle
      AFTER UPDATE ON listings
      FOR EACH ROW
      EXECUTE FUNCTION rm_tasks_deal_lifecycle_hook();
  END IF;
END;
$$;

-- 5. Nightly job function: wake snoozed tasks
CREATE OR REPLACE FUNCTION rm_tasks_wake_snoozed()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE rm_tasks
  SET status = 'open', snoozed_until = NULL, updated_at = now()
  WHERE status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Nightly job function: auto-expire unreviewed AI tasks after 7 days
CREATE OR REPLACE FUNCTION rm_tasks_expire_ai_suggestions()
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE rm_tasks
  SET dismissed_at = now(), updated_at = now()
  WHERE source = 'ai'
    AND confirmed_at IS NULL
    AND dismissed_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS
ALTER TABLE rm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rm_deal_team ENABLE ROW LEVEL SECURITY;

-- rm_tasks: admin team can do everything
CREATE POLICY "admin_all_rm_tasks"
  ON rm_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

-- rm_tasks: users see tasks they own
CREATE POLICY "owner_rm_tasks"
  ON rm_tasks FOR SELECT
  USING (owner_id = auth.uid());

-- rm_tasks: users see tasks on deals they're team members of
CREATE POLICY "deal_team_rm_tasks"
  ON rm_tasks FOR SELECT
  USING (
    deal_team_visible = true
    AND entity_type = 'deal'
    AND EXISTS (
      SELECT 1 FROM rm_deal_team
      WHERE rm_deal_team.deal_id = rm_tasks.entity_id
        AND rm_deal_team.user_id = auth.uid()
    )
  );

-- rm_tasks: task owners can update their own tasks
CREATE POLICY "owner_update_rm_tasks"
  ON rm_tasks FOR UPDATE
  USING (owner_id = auth.uid());

-- rm_tasks: authenticated users can insert tasks
CREATE POLICY "insert_rm_tasks"
  ON rm_tasks FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- rm_tasks: service role bypass
CREATE POLICY "service_role_rm_tasks"
  ON rm_tasks FOR ALL
  USING (auth.role() = 'service_role');

-- rm_deal_team: admin all
CREATE POLICY "admin_all_rm_deal_team"
  ON rm_deal_team FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('owner', 'admin', 'moderator')
    )
  );

-- rm_deal_team: users see their own membership
CREATE POLICY "own_rm_deal_team"
  ON rm_deal_team FOR SELECT
  USING (user_id = auth.uid());

-- rm_deal_team: service role bypass
CREATE POLICY "service_role_rm_deal_team"
  ON rm_deal_team FOR ALL
  USING (auth.role() = 'service_role');
