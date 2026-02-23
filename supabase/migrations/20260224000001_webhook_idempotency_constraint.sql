-- ============================================================================
-- Add unique constraint on docuseal_webhook_log for reliable idempotency.
-- The webhook handler checks for existing (submission_id, event_type) pairs
-- before processing, but without a unique constraint two concurrent webhook
-- deliveries could race past the check. This constraint makes the insert
-- fail with a unique violation instead of creating duplicates.
-- ============================================================================

-- First deduplicate any existing rows (keep the earliest)
DELETE FROM public.docuseal_webhook_log a
USING public.docuseal_webhook_log b
WHERE a.submission_id = b.submission_id
  AND a.event_type = b.event_type
  AND a.created_at > b.created_at;

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_docuseal_webhook_idempotency
  ON public.docuseal_webhook_log(submission_id, event_type);
