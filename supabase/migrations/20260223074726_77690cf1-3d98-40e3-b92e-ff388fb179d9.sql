
-- Clean up 48 stale pending alert delivery logs from Aug 2025
UPDATE alert_delivery_logs 
SET delivery_status = 'failed', 
    error_message = 'Stale: never processed (pending since Aug 2025)'
WHERE delivery_status = 'pending';

-- Reset 3 failed buyer enrichments (401 errors) for retry
UPDATE buyer_enrichment_queue 
SET status = 'pending', 
    attempts = 0, 
    last_error = NULL, 
    started_at = NULL, 
    force = true, 
    updated_at = now()
WHERE status = 'failed' AND last_error LIKE '%401%';
