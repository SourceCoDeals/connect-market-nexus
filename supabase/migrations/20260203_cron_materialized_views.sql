-- Migration: Set up cron job for materialized view refresh
-- Uses pg_cron extension (available in Supabase)

-- =============================================================
-- ENABLE PG_CRON EXTENSION
-- =============================================================

-- Note: pg_cron may need to be enabled via Supabase dashboard
-- Extensions > pg_cron > Enable
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres (required for cron jobs)
GRANT USAGE ON SCHEMA cron TO postgres;

-- =============================================================
-- CREATE REFRESH FUNCTION WITH ERROR HANDLING
-- =============================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views_safe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_result JSONB;
  v_errors TEXT[] := '{}';
BEGIN
  v_start_time := NOW();

  -- Refresh each view with error handling
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deal_pipeline_summary;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'mv_deal_pipeline_summary: ' || SQLERRM);
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_score_tier_distribution;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'mv_score_tier_distribution: ' || SQLERRM);
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_buyer_activity_summary;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'mv_buyer_activity_summary: ' || SQLERRM);
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_universe_performance;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'mv_universe_performance: ' || SQLERRM);
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_geography_distribution;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'mv_geography_distribution: ' || SQLERRM);
  END;

  v_end_time := NOW();

  -- Build result
  v_result := jsonb_build_object(
    'success', array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0,
    'started_at', v_start_time,
    'completed_at', v_end_time,
    'duration_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time)),
    'errors', v_errors
  );

  -- Log the refresh
  INSERT INTO public.cron_job_logs (job_name, result, created_at)
  VALUES ('refresh_materialized_views', v_result, NOW());

  RETURN v_result;
END;
$$;

-- =============================================================
-- CREATE CRON JOB LOG TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent logs
CREATE INDEX idx_cron_job_logs_created ON public.cron_job_logs(created_at DESC);
CREATE INDEX idx_cron_job_logs_job ON public.cron_job_logs(job_name, created_at DESC);

-- Keep only last 7 days of logs (auto-cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.cron_job_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- =============================================================
-- SCHEDULE CRON JOBS
-- =============================================================

-- Refresh materialized views every 15 minutes
SELECT cron.schedule(
  'refresh-materialized-views',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT refresh_materialized_views_safe()$$
);

-- Cleanup old cron logs daily at 3 AM
SELECT cron.schedule(
  'cleanup-cron-logs',
  '0 3 * * *', -- Daily at 3 AM
  $$SELECT cleanup_old_cron_logs()$$
);

-- =============================================================
-- VIEW FOR MONITORING CRON JOBS
-- =============================================================

CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT
  job_name,
  result->>'success' AS success,
  (result->>'duration_ms')::NUMERIC AS duration_ms,
  result->>'errors' AS errors,
  created_at
FROM public.cron_job_logs
ORDER BY created_at DESC
LIMIT 50;

-- Grant access to admins
GRANT SELECT ON public.cron_job_logs TO authenticated;
GRANT SELECT ON public.cron_job_status TO authenticated;

COMMENT ON TABLE public.cron_job_logs IS 'Log of scheduled job executions';
COMMENT ON FUNCTION refresh_materialized_views_safe() IS 'Refreshes all dashboard materialized views with error handling';
