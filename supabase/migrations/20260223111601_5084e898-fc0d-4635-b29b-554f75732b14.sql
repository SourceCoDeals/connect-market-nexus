-- Add unique constraint on docuseal_webhook_log for idempotency (TOCTOU race protection)
-- This prevents concurrent webhook deliveries from creating duplicate log entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_docuseal_webhook_log_submission_event
ON public.docuseal_webhook_log (submission_id, event_type)
WHERE submission_id IS NOT NULL AND event_type IS NOT NULL;