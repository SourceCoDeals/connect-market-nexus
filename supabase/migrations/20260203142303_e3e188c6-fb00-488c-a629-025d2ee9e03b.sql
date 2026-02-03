-- Reset enrichment queue items that failed due to auth issue to retry
UPDATE public.enrichment_queue 
SET status = 'pending', 
    attempts = 0, 
    last_error = NULL 
WHERE status = 'pending' 
  AND attempts > 0 
  AND last_error LIKE '%Missing authorization header%';