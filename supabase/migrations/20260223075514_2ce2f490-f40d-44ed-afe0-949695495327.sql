
-- 1. Reset the 4 failed enrichment queue items for retry
UPDATE enrichment_queue 
SET status = 'pending', 
    last_error = NULL, 
    started_at = NULL, 
    completed_at = NULL, 
    force = true,
    updated_at = now()
WHERE status = 'failed';

-- 2. Fix connection_requests with NULL user_id by adding a default constraint comment
-- These are legitimate anonymous website submissions, but let's ensure the source is tracked
COMMENT ON COLUMN connection_requests.user_id IS 
'Nullable: anonymous website submissions may have NULL user_id. Always check source column for context.';

-- 3. Ensure cron_job_logs has proper insert permissions for cron jobs
-- The table exists but may not be getting written to by pg_cron
GRANT INSERT ON public.cron_job_logs TO postgres;
GRANT SELECT ON public.cron_job_logs TO authenticated;
