-- Fix stuck global_activity_queue entry that's blocking enrichment
UPDATE global_activity_queue 
SET status = 'failed', 
    completed_at = now(),
    error_log = error_log || '["Manually marked as failed - queue was stuck with 0 items processed"]'::jsonb
WHERE id = 'd6346cbf-37af-433c-9564-17824d722e32' 
  AND status = 'running';
