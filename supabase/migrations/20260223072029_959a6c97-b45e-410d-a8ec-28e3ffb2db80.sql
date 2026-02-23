
-- Fix overly permissive RLS policies that grant public role write access

-- 1. captarget_sync_log: should be service_role only
DROP POLICY IF EXISTS "Service role can insert captarget sync logs" ON public.captarget_sync_log;
CREATE POLICY "Service role can insert captarget sync logs" ON public.captarget_sync_log
  FOR INSERT TO service_role WITH CHECK (true);

-- 2. cron_job_logs: should be service_role only
DROP POLICY IF EXISTS "Service role can insert cron logs" ON public.cron_job_logs;
CREATE POLICY "Service role can insert cron logs" ON public.cron_job_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- 3. enrichment_cost_log: should be service_role only
DROP POLICY IF EXISTS "Service role access" ON public.enrichment_cost_log;
CREATE POLICY "Service role access" ON public.enrichment_cost_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. enrichment_rate_limits: should be service_role only
DROP POLICY IF EXISTS "Service role access" ON public.enrichment_rate_limits;
CREATE POLICY "Service role access" ON public.enrichment_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
