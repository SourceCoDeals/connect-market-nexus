-- Migration: Cron Cleanup
-- All 5 materialized views refreshed by refresh_materialized_views_safe() have been dropped
-- in 20260303000000_drop_dead_objects_phase2.sql. This migration replaces the function
-- with a no-op stub and unschedules the cron job.
--
-- cleanup_old_cron_logs cron is KEPT (still useful for log hygiene)
-- cron_job_logs table is KEPT (still written to by other cron jobs)

BEGIN;

-- ============================================================================
-- Replace refresh_materialized_views_safe() with a no-op stub
-- Preserves function signature (RETURNS JSONB, SECURITY DEFINER) in case
-- any external caller references it — returns success immediately
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views_safe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- All materialized views have been dropped as dead code.
  -- This stub preserves the function signature for backwards compatibility.
  RETURN jsonb_build_object(
    'success', true,
    'message', 'No materialized views to refresh — all views dropped as dead code',
    'started_at', NOW(),
    'completed_at', NOW(),
    'duration_ms', 0,
    'errors', '{}'::text[]
  );
END;
$$;

-- ============================================================================
-- Unschedule the materialized views refresh cron job (was running every 15 min)
-- ============================================================================

SELECT cron.unschedule('refresh-materialized-views');

COMMIT;
