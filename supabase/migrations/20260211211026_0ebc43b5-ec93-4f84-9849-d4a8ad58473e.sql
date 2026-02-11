-- Reset buyer enrichment queue items that failed with HTTP 401 (stale deployment auth issue)
-- These should retry now that the deployment is current
UPDATE buyer_enrichment_queue
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    started_at = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND last_error = 'HTTP 401';

-- Also reset items that were stuck in pending for >3 days (already audited but still failed)
UPDATE buyer_enrichment_queue
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    started_at = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND last_error LIKE 'Reset by system audit%';