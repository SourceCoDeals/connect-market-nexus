-- Reset stuck buyer enrichment items: mark as failed so they don't block,
-- users can re-trigger enrichment fresh
UPDATE public.buyer_enrichment_queue 
SET status = 'failed', 
    last_error = 'Reset by system audit: stuck in pending for >3 days',
    completed_at = now(),
    updated_at = now()
WHERE status = 'pending' 
  AND updated_at < now() - interval '1 hour';
