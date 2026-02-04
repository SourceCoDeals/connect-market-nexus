-- Add monitoring views and cron jobs for background processes
-- This ensures zombie cleanup runs automatically and provides visibility into job health

-- ============= MONITORING VIEWS =============

-- Admin view for tracking background job health over last 24 hours
CREATE OR REPLACE VIEW admin_background_job_health AS
SELECT
  'guide_generation' as job_type,
  status,
  COUNT(*) as count,
  MAX(started_at) as last_started,
  MAX(completed_at) as last_completed,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_duration_seconds
FROM ma_guide_generations
WHERE started_at > now() - interval '24 hours'
GROUP BY status

UNION ALL

SELECT
  'criteria_extraction' as job_type,
  status,
  COUNT(*) as count,
  MAX(started_at) as last_started,
  MAX(completed_at) as last_completed,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_duration_seconds
FROM buyer_criteria_extractions
WHERE started_at > now() - interval '24 hours'
GROUP BY status

ORDER BY job_type, status;

COMMENT ON VIEW admin_background_job_health IS
  'Provides 24-hour health metrics for background jobs: guide generation and criteria extraction. Use to monitor success rates, identify stuck jobs, and track performance.';

-- View for currently running jobs (potential zombies)
CREATE OR REPLACE VIEW admin_running_jobs AS
SELECT
  'guide_generation' as job_type,
  id,
  universe_id,
  status,
  current_phase,
  phases_completed,
  total_phases,
  started_at,
  EXTRACT(EPOCH FROM (now() - started_at)) as running_seconds,
  CASE
    WHEN started_at < now() - interval '10 minutes' THEN 'ZOMBIE'
    WHEN started_at < now() - interval '8 minutes' THEN 'WARNING'
    ELSE 'OK'
  END as health_status
FROM ma_guide_generations
WHERE status = 'processing'

UNION ALL

SELECT
  'criteria_extraction' as job_type,
  id,
  universe_id,
  status,
  current_phase,
  phases_completed,
  total_phases,
  started_at,
  EXTRACT(EPOCH FROM (now() - started_at)) as running_seconds,
  CASE
    WHEN started_at < now() - interval '10 minutes' THEN 'ZOMBIE'
    WHEN started_at < now() - interval '8 minutes' THEN 'WARNING'
    ELSE 'OK'
  END as health_status
FROM buyer_criteria_extractions
WHERE status = 'processing'

ORDER BY started_at ASC;

COMMENT ON VIEW admin_running_jobs IS
  'Shows currently running background jobs with health status. ZOMBIE = stuck >10min, WARNING = >8min, OK = normal. Use for real-time monitoring.';

-- ============= CRON JOB SETUP =============

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule zombie cleanup for criteria extractions (every 5 minutes)
SELECT cron.schedule(
  'cleanup-zombie-criteria-extractions',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT cleanup_zombie_criteria_extractions();$$
);

-- Schedule zombie cleanup for M&A guide generations (every 5 minutes)
SELECT cron.schedule(
  'cleanup-zombie-guide-generations',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT cleanup_zombie_ma_guide_generations();$$
);

COMMENT ON EXTENSION pg_cron IS
  'Cron-based job scheduler for PostgreSQL. Used to run zombie cleanup functions every 5 minutes.';

-- ============= LOGGING TABLE =============

-- Create table to track cron job execution history
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  affected_count integer,
  error text,
  duration_ms integer
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_executed_at ON cron_job_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON cron_job_logs(job_name);

COMMENT ON TABLE cron_job_logs IS
  'Tracks execution history of cron jobs for monitoring and debugging. Logs each run with affected row counts and errors.';

-- ============= ENHANCED CLEANUP FUNCTIONS =============

-- Update cleanup functions to log their execution
CREATE OR REPLACE FUNCTION cleanup_zombie_criteria_extractions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
  start_time timestamptz;
  duration_ms integer;
BEGIN
  start_time := clock_timestamp();

  UPDATE buyer_criteria_extractions
  SET
    status = 'failed',
    error = 'Extraction timed out after 10 minutes',
    completed_at = now()
  WHERE
    status = 'processing'
    AND started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

  -- Log execution
  INSERT INTO cron_job_logs (job_name, affected_count, duration_ms)
  VALUES ('cleanup-zombie-criteria-extractions', affected_count, duration_ms);

  IF affected_count > 0 THEN
    RAISE NOTICE 'Marked % zombie criteria extraction(s) as failed', affected_count;
  END IF;

  RETURN affected_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_zombie_ma_guide_generations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
  start_time timestamptz;
  duration_ms integer;
BEGIN
  start_time := clock_timestamp();

  UPDATE ma_guide_generations
  SET
    status = 'failed',
    error = 'Generation timed out after 10 minutes',
    completed_at = now(),
    updated_at = now()
  WHERE
    status = 'processing'
    AND started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

  -- Log execution
  INSERT INTO cron_job_logs (job_name, affected_count, duration_ms)
  VALUES ('cleanup-zombie-guide-generations', affected_count, duration_ms);

  IF affected_count > 0 THEN
    RAISE NOTICE 'Marked % zombie guide generation(s) as failed', affected_count;
  END IF;

  RETURN affected_count;
END;
$$;

-- ============= ADMIN HELPER FUNCTIONS =============

-- Function to manually trigger all cleanup jobs (for testing/emergency use)
CREATE OR REPLACE FUNCTION admin_run_all_cleanup_jobs()
RETURNS TABLE(job_name text, affected_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'cleanup-zombie-criteria-extractions'::text,
    cleanup_zombie_criteria_extractions()
  UNION ALL
  SELECT
    'cleanup-zombie-guide-generations'::text,
    cleanup_zombie_ma_guide_generations();
END;
$$;

COMMENT ON FUNCTION admin_run_all_cleanup_jobs IS
  'Manually trigger all zombie cleanup jobs. Returns job names and affected counts. Use for testing or emergency cleanup.';

-- Function to get recent cron job execution summary
CREATE OR REPLACE FUNCTION admin_get_cron_job_summary(hours_back integer DEFAULT 24)
RETURNS TABLE(
  job_name text,
  executions bigint,
  total_affected bigint,
  avg_duration_ms numeric,
  last_execution timestamptz,
  error_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    job_name,
    COUNT(*) as executions,
    SUM(affected_count) as total_affected,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    MAX(executed_at) as last_execution,
    COUNT(*) FILTER (WHERE error IS NOT NULL) as error_count
  FROM cron_job_logs
  WHERE executed_at > now() - (hours_back || ' hours')::interval
  GROUP BY job_name
  ORDER BY last_execution DESC;
$$;

COMMENT ON FUNCTION admin_get_cron_job_summary IS
  'Get summary of cron job executions over specified time period (default 24 hours). Shows execution counts, affected rows, performance, and errors.';
