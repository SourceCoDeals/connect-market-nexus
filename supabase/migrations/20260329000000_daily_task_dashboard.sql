-- ============================================================================
-- Daily Task Dashboard - Database Schema
-- Fireflies-powered task extraction, assignment & accountability tracking
-- ============================================================================

-- 1. Standup meetings tracking table
CREATE TABLE IF NOT EXISTS public.standup_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fireflies_transcript_id text NOT NULL,
  fireflies_meeting_id text,
  meeting_title text,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  meeting_duration_minutes integer,
  transcript_text text,
  tasks_extracted integer DEFAULT 0,
  tasks_unassigned integer DEFAULT 0,
  extraction_confidence_avg numeric(5,2),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fireflies_transcript_id)
);

-- 2. BD Team aliases for speaker-to-member mapping
CREATE TABLE IF NOT EXISTS public.bd_team_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(alias)
);

-- 3. Daily tasks - core task storage
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL DEFAULT 'other' CHECK (task_type IN (
    'contact_owner', 'build_buyer_universe', 'follow_up_with_buyer',
    'send_materials', 'update_pipeline', 'schedule_call', 'other'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  source_meeting_id uuid REFERENCES public.standup_meetings(id) ON DELETE SET NULL,
  source_timestamp text,
  deal_reference text,
  deal_id uuid,
  -- Priority scoring fields (Section 5.8)
  priority_score numeric(6,2) DEFAULT 50.0,
  priority_rank integer,
  is_pinned boolean DEFAULT false,
  pinned_rank integer,
  pinned_by uuid REFERENCES auth.users(id),
  pinned_at timestamptz,
  pin_reason text,
  -- AI extraction metadata
  extraction_confidence text DEFAULT 'high' CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  needs_review boolean DEFAULT false,
  is_manual boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Pin override audit log
CREATE TABLE IF NOT EXISTS public.daily_task_pin_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('pinned', 'unpinned', 'rank_changed')),
  old_rank integer,
  new_rank integer,
  reason text,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_daily_tasks_assignee ON public.daily_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_due_date ON public.daily_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON public.daily_tasks(status);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assignee_due ON public.daily_tasks(assignee_id, due_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_source_meeting ON public.daily_tasks(source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_deal_id ON public.daily_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_standup_meetings_date ON public.standup_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_bd_team_aliases_member ON public.bd_team_aliases(team_member_id);
CREATE INDEX IF NOT EXISTS idx_bd_team_aliases_alias ON public.bd_team_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_daily_task_pin_log_task ON public.daily_task_pin_log(task_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.standup_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_task_pin_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all tables (uses existing is_admin function)
CREATE POLICY "Admins can manage standup_meetings" ON public.standup_meetings
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage bd_team_aliases" ON public.bd_team_aliases
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage daily_tasks" ON public.daily_tasks
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage daily_task_pin_log" ON public.daily_task_pin_log
  FOR ALL USING (public.is_admin(auth.uid()));

-- Service role access for edge functions
CREATE POLICY "Service role can manage standup_meetings" ON public.standup_meetings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage daily_tasks" ON public.daily_tasks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Auto-update timestamps trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_daily_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_daily_tasks_updated_at
  BEFORE UPDATE ON public.daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_tasks_updated_at();

CREATE TRIGGER set_standup_meetings_updated_at
  BEFORE UPDATE ON public.standup_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_tasks_updated_at();

-- ============================================================================
-- Auto mark overdue tasks (can be called by a cron or on-demand)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_overdue_daily_tasks()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.daily_tasks
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get task analytics for a team member over a time range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_task_analytics(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT CURRENT_DATE,
  p_assignee_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  from_dt date;
BEGIN
  from_dt := COALESCE(p_from_date, '2020-01-01'::date);

  SELECT jsonb_build_object(
    'total_assigned', COUNT(*),
    'total_completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'total_overdue', COUNT(*) FILTER (WHERE status = 'overdue'),
    'total_pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'completion_rate', CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END,
    'avg_completion_hours', ROUND(AVG(
      CASE WHEN completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600.0
        ELSE NULL
      END
    )::numeric, 1),
    'by_task_type', (
      SELECT jsonb_object_agg(task_type, jsonb_build_object(
        'total', type_total,
        'completed', type_completed,
        'rate', CASE WHEN type_total > 0 THEN ROUND((type_completed::numeric / type_total::numeric) * 100, 1) ELSE 0 END
      ))
      FROM (
        SELECT task_type,
          COUNT(*) as type_total,
          COUNT(*) FILTER (WHERE status = 'completed') as type_completed
        FROM public.daily_tasks dt2
        WHERE dt2.due_date BETWEEN from_dt AND p_to_date
          AND (p_assignee_id IS NULL OR dt2.assignee_id = p_assignee_id)
        GROUP BY task_type
      ) sub
    ),
    'daily_trend', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', day_date,
        'assigned', day_total,
        'completed', day_completed,
        'rate', CASE WHEN day_total > 0 THEN ROUND((day_completed::numeric / day_total::numeric) * 100, 1) ELSE 0 END
      ) ORDER BY day_date)
      FROM (
        SELECT due_date as day_date,
          COUNT(*) as day_total,
          COUNT(*) FILTER (WHERE status = 'completed') as day_completed
        FROM public.daily_tasks dt3
        WHERE dt3.due_date BETWEEN from_dt AND p_to_date
          AND (p_assignee_id IS NULL OR dt3.assignee_id = p_assignee_id)
        GROUP BY due_date
      ) sub2
    )
  ) INTO result
  FROM public.daily_tasks dt
  WHERE dt.due_date BETWEEN from_dt AND p_to_date
    AND (p_assignee_id IS NULL OR dt.assignee_id = p_assignee_id);

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get team leaderboard analytics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_task_team_analytics(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  from_dt date;
BEGIN
  from_dt := COALESCE(p_from_date, '2020-01-01'::date);

  SELECT jsonb_build_object(
    'team_completion_rate', CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE dt.status = 'completed')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END,
    'total_tasks', COUNT(*),
    'total_completed', COUNT(*) FILTER (WHERE dt.status = 'completed'),
    'total_overdue', COUNT(*) FILTER (WHERE dt.status = 'overdue'),
    'leaderboard', (
      SELECT jsonb_agg(member_row ORDER BY member_rate DESC)
      FROM (
        SELECT jsonb_build_object(
          'assignee_id', dt2.assignee_id,
          'total', COUNT(*),
          'completed', COUNT(*) FILTER (WHERE dt2.status = 'completed'),
          'overdue', COUNT(*) FILTER (WHERE dt2.status = 'overdue'),
          'rate', CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE dt2.status = 'completed')::numeric / COUNT(*)::numeric) * 100, 1)
            ELSE 0 END
        ) as member_row,
        CASE WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE dt2.status = 'completed')::numeric / COUNT(*)::numeric)
          ELSE 0 END as member_rate
        FROM public.daily_tasks dt2
        WHERE dt2.due_date BETWEEN from_dt AND p_to_date
        GROUP BY dt2.assignee_id
      ) sub
    ),
    'tasks_per_day', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', day_date,
        'count', day_count
      ) ORDER BY day_date)
      FROM (
        SELECT due_date as day_date, COUNT(*) as day_count
        FROM public.daily_tasks dt3
        WHERE dt3.due_date BETWEEN from_dt AND p_to_date
        GROUP BY due_date
      ) sub2
    ),
    'overdue_by_type', (
      SELECT jsonb_object_agg(task_type, overdue_count)
      FROM (
        SELECT task_type, COUNT(*) as overdue_count
        FROM public.daily_tasks dt4
        WHERE dt4.due_date BETWEEN from_dt AND p_to_date
          AND dt4.status = 'overdue'
        GROUP BY task_type
      ) sub3
    ),
    'overdue_by_member', (
      SELECT jsonb_object_agg(assignee_id::text, overdue_count)
      FROM (
        SELECT assignee_id, COUNT(*) as overdue_count
        FROM public.daily_tasks dt5
        WHERE dt5.due_date BETWEEN from_dt AND p_to_date
          AND dt5.status = 'overdue'
        GROUP BY assignee_id
      ) sub4
    ),
    'unassigned_count', (
      SELECT COUNT(*)
      FROM public.daily_tasks dt6
      WHERE dt6.due_date BETWEEN from_dt AND p_to_date
        AND dt6.needs_review = true
    )
  ) INTO result
  FROM public.daily_tasks dt
  WHERE dt.due_date BETWEEN from_dt AND p_to_date;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Get meeting quality analytics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_meeting_quality_analytics(
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  from_dt date;
BEGIN
  from_dt := COALESCE(p_from_date, '2020-01-01'::date);

  SELECT jsonb_build_object(
    'total_meetings', COUNT(DISTINCT sm.id),
    'avg_tasks_per_meeting', ROUND(AVG(sm.tasks_extracted)::numeric, 1),
    'avg_extraction_confidence', ROUND(AVG(sm.extraction_confidence_avg)::numeric, 1),
    'needs_review_rate', CASE
      WHEN SUM(sm.tasks_extracted) > 0
      THEN ROUND((SUM(sm.tasks_unassigned)::numeric / SUM(sm.tasks_extracted)::numeric) * 100, 1)
      ELSE 0
    END,
    'confidence_breakdown', (
      SELECT jsonb_build_object(
        'high', COUNT(*) FILTER (WHERE dt.extraction_confidence = 'high'),
        'medium', COUNT(*) FILTER (WHERE dt.extraction_confidence = 'medium'),
        'low', COUNT(*) FILTER (WHERE dt.extraction_confidence = 'low')
      )
      FROM public.daily_tasks dt
      WHERE dt.source_meeting_id IS NOT NULL
        AND dt.created_at::date BETWEEN from_dt AND p_to_date
    ),
    'meetings_trend', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', m_date,
        'tasks_extracted', m_tasks,
        'confidence', m_confidence,
        'unassigned', m_unassigned,
        'duration_minutes', m_duration
      ) ORDER BY m_date)
      FROM (
        SELECT sm2.meeting_date as m_date,
          sm2.tasks_extracted as m_tasks,
          sm2.extraction_confidence_avg as m_confidence,
          sm2.tasks_unassigned as m_unassigned,
          sm2.meeting_duration_minutes as m_duration
        FROM public.standup_meetings sm2
        WHERE sm2.meeting_date BETWEEN from_dt AND p_to_date
          AND sm2.processing_status = 'completed'
      ) sub
    ),
    'assignee_match_rate', CASE
      WHEN SUM(sm.tasks_extracted) > 0
      THEN ROUND(((SUM(sm.tasks_extracted) - SUM(sm.tasks_unassigned))::numeric / SUM(sm.tasks_extracted)::numeric) * 100, 1)
      ELSE 0
    END
  ) INTO result
  FROM public.standup_meetings sm
  WHERE sm.meeting_date BETWEEN from_dt AND p_to_date
    AND sm.processing_status = 'completed';

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
