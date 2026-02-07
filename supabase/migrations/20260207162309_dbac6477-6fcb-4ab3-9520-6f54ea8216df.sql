
-- Reset stuck processing and failed items so they can be retried with the fixed queue worker
UPDATE buyer_enrichment_queue 
SET status = 'pending', 
    started_at = NULL, 
    attempts = 0,
    last_error = 'Reset for retry after queue concurrency fix',
    updated_at = now()
WHERE status IN ('processing', 'failed');
