-- ═══════════════════════════════════════════════════════════════════════
-- AI Task System v3.1 — Schema Migration
-- Extends existing daily_standup_tasks system with entity linking,
-- deal team membership, signals, cadence, comments, activity logs,
-- and supporting configuration tables.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Extend daily_standup_tasks ──────────────────────────────────

-- Entity linking columns
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'deal',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS secondary_entity_type text,
  ADD COLUMN IF NOT EXISTS secondary_entity_id uuid;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_entity_type_check
    CHECK (entity_type IN ('listing','deal','buyer','contact'))
    NOT VALID;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_secondary_entity_type_check
    CHECK (secondary_entity_type IS NULL OR secondary_entity_type IN ('listing','deal','buyer','contact'))
    NOT VALID;

-- New status values — drop old constraint and add expanded one
DO $$
BEGIN
  -- Drop any existing status check constraint
  ALTER TABLE public.daily_standup_tasks
    DROP CONSTRAINT IF EXISTS daily_standup_tasks_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Some projects name the constraint differently
DO $$
BEGIN
  ALTER TABLE public.daily_standup_tasks
    DROP CONSTRAINT IF EXISTS dst_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_status_check
    CHECK (status IN ('pending','pending_approval','in_progress','completed','overdue','snoozed','cancelled','listing_closed'))
    NOT VALID;

-- Source tracking
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_source_check
    CHECK (source IN ('manual','ai','chatbot','system','template'))
    NOT VALID;

-- AI-specific fields
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS ai_evidence_quote text,
  ADD COLUMN IF NOT EXISTS ai_relevance_score integer,
  ADD COLUMN IF NOT EXISTS ai_confidence text,
  ADD COLUMN IF NOT EXISTS ai_speaker_assigned_to text,
  ADD COLUMN IF NOT EXISTS transcript_id text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_ai_confidence_check
    CHECK (ai_confidence IS NULL OR ai_confidence IN ('high','medium'))
    NOT VALID;

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_ai_speaker_check
    CHECK (ai_speaker_assigned_to IS NULL OR ai_speaker_assigned_to IN ('advisor','seller','buyer','unknown'))
    NOT VALID;

-- Completion evidence
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS completion_transcript_id text;

-- Team visibility & dependencies
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS deal_team_visible boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS depends_on uuid,
  ADD COLUMN IF NOT EXISTS snoozed_until date,
  ADD COLUMN IF NOT EXISTS buyer_deal_score integer;

-- Self-referencing FK for depends_on
DO $$
BEGIN
  ALTER TABLE public.daily_standup_tasks
    ADD CONSTRAINT dst_depends_on_fk
    FOREIGN KEY (depends_on) REFERENCES public.daily_standup_tasks(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Priority text field
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_priority_check
    CHECK (priority IN ('high','medium','low'))
    NOT VALID;

-- Created by
ALTER TABLE public.daily_standup_tasks
  ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
  ALTER TABLE public.daily_standup_tasks
    ADD CONSTRAINT dst_created_by_fk
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_dst_entity ON public.daily_standup_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dst_secondary_entity ON public.daily_standup_tasks(secondary_entity_type, secondary_entity_id);
CREATE INDEX IF NOT EXISTS idx_dst_status_due ON public.daily_standup_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_dst_assignee_status ON public.daily_standup_tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_dst_source ON public.daily_standup_tasks(source);
CREATE INDEX IF NOT EXISTS idx_dst_expires ON public.daily_standup_tasks(expires_at) WHERE expires_at IS NOT NULL;

-- ─── 2. Backfill entity fields from existing deal_id ────────────────

UPDATE public.daily_standup_tasks
SET entity_type = 'deal', entity_id = deal_id
WHERE deal_id IS NOT NULL AND entity_id IS NULL;

UPDATE public.daily_standup_tasks
SET source = CASE WHEN is_manual THEN 'manual' ELSE 'ai' END
WHERE source IS NULL OR (source = 'manual' AND NOT is_manual);

-- ─── 2b. Entity-linking constraint for AI tasks ───────────────────
-- AI-generated tasks MUST be linked to a real entity. This prevents
-- orphan tasks that don't relate to any deal or buyer.
ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_ai_entity_required
    CHECK (
      source != 'ai' OR entity_id IS NOT NULL
    )
    NOT VALID;

-- Template tasks also require entity linking
ALTER TABLE public.daily_standup_tasks
  ADD CONSTRAINT dst_template_entity_required
    CHECK (
      source != 'template' OR entity_id IS NOT NULL
    )
    NOT VALID;

-- Validate all constraints on new data going forward
ALTER TABLE public.daily_standup_tasks VALIDATE CONSTRAINT dst_entity_type_check;
ALTER TABLE public.daily_standup_tasks VALIDATE CONSTRAINT dst_source_check;
ALTER TABLE public.daily_standup_tasks VALIDATE CONSTRAINT dst_priority_check;
ALTER TABLE public.daily_standup_tasks VALIDATE CONSTRAINT dst_ai_entity_required;
ALTER TABLE public.daily_standup_tasks VALIDATE CONSTRAINT dst_template_entity_required;


-- ─── 3. rm_deal_team (Deal Team Membership) ────────────────────────

CREATE TABLE IF NOT EXISTS public.rm_deal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('lead','analyst','support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

ALTER TABLE public.rm_deal_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own team memberships"
  ON public.rm_deal_team FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage deal teams"
  ON public.rm_deal_team FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );


-- ─── 4. rm_deal_signals (AI-Detected Intelligence) ─────────────────

CREATE TABLE IF NOT EXISTS public.rm_deal_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,
  transcript_id text NOT NULL,
  signal_type text NOT NULL
    CHECK (signal_type IN ('positive','warning','critical','neutral')),
  signal_category text NOT NULL,
  summary text NOT NULL,
  verbatim_quote text,
  acknowledged_by uuid REFERENCES public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rm_deal_signals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_signals_listing ON public.rm_deal_signals(listing_id);
CREATE INDEX IF NOT EXISTS idx_signals_deal ON public.rm_deal_signals(deal_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON public.rm_deal_signals(signal_type);

CREATE POLICY "Admins see all signals"
  ON public.rm_deal_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );

CREATE POLICY "Deal team sees listing signals"
  ON public.rm_deal_signals FOR SELECT
  USING (
    listing_id IN (
      SELECT listing_id FROM public.rm_deal_team WHERE user_id = auth.uid()
    )
  );


-- ─── 5. rm_buyer_deal_cadence (Stage-Aware Contact Schedules) ──────

CREATE TABLE IF NOT EXISTS public.rm_buyer_deal_cadence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  deal_stage_name text NOT NULL,
  expected_contact_days integer NOT NULL DEFAULT 14,
  last_contacted_at timestamptz,
  last_contact_source text
    CHECK (last_contact_source IS NULL OR last_contact_source IN (
      'task','fireflies','smartlead','smartlead_reply','direct_email','meeting'
    )),
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, deal_id)
);

ALTER TABLE public.rm_buyer_deal_cadence ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cadence_buyer ON public.rm_buyer_deal_cadence(buyer_id);
CREATE INDEX IF NOT EXISTS idx_cadence_deal ON public.rm_buyer_deal_cadence(deal_id);
CREATE INDEX IF NOT EXISTS idx_cadence_overdue ON public.rm_buyer_deal_cadence(last_contacted_at)
  WHERE is_active = true;

CREATE POLICY "Admins manage cadence"
  ON public.rm_buyer_deal_cadence FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );


-- ─── 6. rm_task_extractions (Extraction Run Log) ───────────────────

CREATE TABLE IF NOT EXISTS public.rm_task_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text NOT NULL,
  transcript_status text DEFAULT 'queued'
    CHECK (transcript_status IN ('queued','ready','processing','completed','failed')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  deal_stage_at_extraction text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  tasks_saved integer DEFAULT 0,
  tasks_discarded integer DEFAULT 0,
  signals_extracted integer DEFAULT 0,
  failure_reason text,
  run_at timestamptz DEFAULT now()
);

ALTER TABLE public.rm_task_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see extractions"
  ON public.rm_task_extractions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );


-- ─── 7. rm_task_discards (Guardrail Audit Log) ─────────────────────

CREATE TABLE IF NOT EXISTS public.rm_task_discards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id text,
  entity_type text,
  entity_id uuid,
  candidate_title text,
  discard_reason text
    CHECK (discard_reason IN (
      'failed_category','failed_relevance','failed_confidence',
      'failed_record_lookup','failed_stage','duplicate','auto_expired'
    )),
  ai_relevance_score integer,
  ai_confidence text,
  quote text,
  discarded_at timestamptz DEFAULT now()
);

ALTER TABLE public.rm_task_discards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see discards"
  ON public.rm_task_discards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );


-- ─── 8. rm_task_activity_log (Audit Trail) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.rm_task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.daily_standup_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN (
      'created','edited','reassigned','completed','reopened',
      'snoozed','cancelled','confirmed','dismissed','commented',
      'priority_changed','status_changed','dependency_added'
    )),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rm_task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.rm_task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON public.rm_task_activity_log(user_id);

CREATE POLICY "Admins see activity log"
  ON public.rm_task_activity_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );


-- ─── 9. rm_task_comments (Threaded Discussion) ─────────────────────

CREATE TABLE IF NOT EXISTS public.rm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.daily_standup_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rm_task_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.rm_task_comments(task_id);

CREATE POLICY "Admins manage comments"
  ON public.rm_task_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );

CREATE POLICY "Comment authors see own"
  ON public.rm_task_comments FOR SELECT
  USING (user_id = auth.uid());


-- ─── 10. platform_settings (Configurable Thresholds) ────────────────

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins update settings"
  ON public.platform_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','owner')
    )
  );

-- Seed defaults (values as proper JSONB numbers)
INSERT INTO public.platform_settings (key, value) VALUES
  ('ai_relevance_threshold', '7'::jsonb),
  ('ai_task_expiry_days', '7'::jsonb),
  ('ai_task_expiry_warning_days', '5'::jsonb),
  ('buyer_spotlight_default_cadence_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ─── 11. Add is_retained flag to listings ───────────────────────────

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_retained boolean DEFAULT false;


-- ─── 12. Index for deal-team RLS path ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deals_listing ON public.deals(listing_id);


-- ─── 13. Deal lifecycle triggers ────────────────────────────────────

-- Function: auto-handle tasks when listing status changes
CREATE OR REPLACE FUNCTION public.handle_listing_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- listing -> sold: close all open tasks
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    UPDATE public.daily_standup_tasks
    SET status = 'listing_closed',
        updated_at = now()
    WHERE entity_type = 'listing' AND entity_id = NEW.id
      AND status IN ('pending','pending_approval','in_progress','overdue');

    -- Also close tasks on deals under this listing
    UPDATE public.daily_standup_tasks
    SET status = 'listing_closed',
        updated_at = now()
    WHERE entity_type = 'deal' AND entity_id IN (
      SELECT id FROM public.deals WHERE listing_id = NEW.id
    )
    AND status IN ('pending','pending_approval','in_progress','overdue');
  END IF;

  -- listing -> inactive: snooze all open tasks (30 days)
  IF NEW.status = 'inactive' AND OLD.status = 'active' THEN
    UPDATE public.daily_standup_tasks
    SET status = 'snoozed',
        snoozed_until = CURRENT_DATE + INTERVAL '30 days',
        updated_at = now()
    WHERE entity_type = 'listing' AND entity_id = NEW.id
      AND status IN ('pending','pending_approval','in_progress','overdue');
  END IF;

  -- listing -> active (re-activated): wake snoozed tasks
  IF NEW.status = 'active' AND OLD.status = 'inactive' THEN
    UPDATE public.daily_standup_tasks
    SET status = 'pending',
        snoozed_until = NULL,
        updated_at = now()
    WHERE entity_type = 'listing' AND entity_id = NEW.id
      AND status = 'snoozed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_status_change ON public.listings;
CREATE TRIGGER trg_listing_status_change
  AFTER UPDATE OF status ON public.listings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_listing_status_change();


-- Function: auto-handle tasks when deal reaches terminal stage
CREATE OR REPLACE FUNCTION public.handle_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_stage_name text;
BEGIN
  -- Look up stage name
  SELECT name INTO new_stage_name
  FROM public.deal_stages
  WHERE id = NEW.stage_id;

  -- Closed Won: auto-complete tasks on this deal
  IF new_stage_name = 'Closed Won' THEN
    UPDATE public.daily_standup_tasks
    SET status = 'completed',
        completion_notes = 'Deal closed won — auto-completed',
        completed_at = now(),
        updated_at = now()
    WHERE entity_type = 'deal' AND entity_id = NEW.id
      AND status IN ('pending','pending_approval','in_progress','overdue');
  END IF;

  -- Closed Lost: auto-cancel tasks on this deal
  IF new_stage_name = 'Closed Lost' THEN
    UPDATE public.daily_standup_tasks
    SET status = 'cancelled',
        updated_at = now()
    WHERE entity_type = 'deal' AND entity_id = NEW.id
      AND status IN ('pending','pending_approval','in_progress','overdue');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON public.deals;
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE OF stage_id ON public.deals
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION public.handle_deal_stage_change();


-- ─── 14. Snoozed task wake-up function (call via pg_cron daily) ─────

CREATE OR REPLACE FUNCTION public.wake_snoozed_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.daily_standup_tasks
  SET status = 'pending',
      snoozed_until = NULL,
      updated_at = now()
  WHERE status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= CURRENT_DATE;
END;
$$;


-- ─── 15. AI task expiry function (call via pg_cron daily) ───────────

CREATE OR REPLACE FUNCTION public.expire_unreviewed_ai_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Move to discards table
  INSERT INTO public.rm_task_discards (transcript_id, entity_type, entity_id, candidate_title, discard_reason, ai_relevance_score, ai_confidence)
  SELECT transcript_id, entity_type, entity_id, title, 'auto_expired', ai_relevance_score, ai_confidence
  FROM public.daily_standup_tasks
  WHERE source = 'ai'
    AND confirmed_at IS NULL
    AND dismissed_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  -- Delete expired tasks
  DELETE FROM public.daily_standup_tasks
  WHERE source = 'ai'
    AND confirmed_at IS NULL
    AND dismissed_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;


-- ─── 16. Privacy purge function (call via pg_cron nightly) ──────────

CREATE OR REPLACE FUNCTION public.purge_ai_quotes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.daily_standup_tasks
  SET ai_evidence_quote = '[Quote purged — 90-day retention policy]'
  WHERE ai_evidence_quote IS NOT NULL
    AND ai_evidence_quote != '[Quote purged — 90-day retention policy]'
    AND created_at < now() - INTERVAL '90 days';

  UPDATE public.rm_deal_signals
  SET verbatim_quote = '[Quote purged — 90-day retention policy]'
  WHERE verbatim_quote IS NOT NULL
    AND verbatim_quote != '[Quote purged — 90-day retention policy]'
    AND created_at < now() - INTERVAL '90 days';

  DELETE FROM public.rm_task_discards
  WHERE discarded_at < now() - INTERVAL '90 days';
END;
$$;


-- ─── 17. Additional performance indexes ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_task_activity_created
  ON public.rm_task_activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_signals_unacknowledged
  ON public.rm_deal_signals(acknowledged_at)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cadence_active_contact
  ON public.rm_buyer_deal_cadence(is_active, last_contacted_at)
  WHERE is_active = true;
