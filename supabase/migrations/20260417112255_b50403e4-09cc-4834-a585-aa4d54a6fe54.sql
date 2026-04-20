
-- Mark the stuck run as failed so it doesn't block anything
UPDATE public.contact_backfill_runs
SET status = 'failed',
    error = COALESCE(error, 'Stuck run reaped during overhaul migration'),
    completed_at = now()
WHERE status = 'running';

-- Add resumability fields to contact_backfill_runs (idempotent)
ALTER TABLE public.contact_backfill_runs
  ADD COLUMN IF NOT EXISTS pending_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Allow new terminal/intermediate statuses (no enum used; status is TEXT)
-- Valid values: running | completed | failed | paused | needs_resume

-- Per-lead durable queue
CREATE TABLE IF NOT EXISTS public.contact_backfill_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.contact_backfill_runs(id) ON DELETE CASCADE,
  valuation_lead_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | skipped
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result JSONB,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (run_id, valuation_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_backfill_queue_run_status
  ON public.contact_backfill_queue (run_id, status);

CREATE INDEX IF NOT EXISTS idx_contact_backfill_queue_pending
  ON public.contact_backfill_queue (status, enqueued_at)
  WHERE status = 'pending';

ALTER TABLE public.contact_backfill_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read contact backfill queue" ON public.contact_backfill_queue;
CREATE POLICY "Admins can read contact backfill queue"
  ON public.contact_backfill_queue
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
