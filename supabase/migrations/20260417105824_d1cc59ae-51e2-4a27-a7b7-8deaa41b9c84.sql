-- Bulk-run status table for backfill-valuation-lead-contacts
CREATE TABLE IF NOT EXISTS public.contact_backfill_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_kind TEXT NOT NULL DEFAULT 'valuation_leads',
  triggered_by UUID,
  triggered_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- running | completed | failed
  eligible_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  found_phone_count INTEGER NOT NULL DEFAULT 0,
  found_linkedin_count INTEGER NOT NULL DEFAULT 0,
  queued_clay_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  rate_limited_retried INTEGER NOT NULL DEFAULT 0,
  rate_limited_dropped INTEGER NOT NULL DEFAULT 0,
  chain_depth INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_backfill_runs_status_created
  ON public.contact_backfill_runs (status, created_at DESC);

ALTER TABLE public.contact_backfill_runs ENABLE ROW LEVEL SECURITY;

-- Admin-only read
DROP POLICY IF EXISTS "Admins can read contact backfill runs" ON public.contact_backfill_runs;
CREATE POLICY "Admins can read contact backfill runs"
  ON public.contact_backfill_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
