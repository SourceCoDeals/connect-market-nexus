-- Migration: Set up cron job for processing enrichment queue
-- Uses pg_cron + pg_net to call edge function
--
-- =============================================================
-- SETUP INSTRUCTIONS (REQUIRED):
-- =============================================================
-- After running this migration, configure the database settings:
--
-- Option 1: Via Supabase Dashboard > SQL Editor
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
--
-- Option 2: Via Supabase Dashboard > Database Settings > Vault
--   Add secrets: supabase_url and service_role_key
--
-- Then verify settings work:
--   SELECT trigger_enrichment_queue_processor();
--
-- =============================================================
-- ENABLE PG_NET EXTENSION (for HTTP calls from Postgres)
-- =============================================================

-- Note: pg_net may need to be enabled via Supabase dashboard
-- Extensions > pg_net > Enable
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================
-- CREATE CRON JOB LOGS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON public.cron_job_logs(job_name, created_at DESC);

-- =============================================================
-- CREATE FUNCTION TO CALL ENRICHMENT QUEUE PROCESSOR
-- =============================================================

CREATE OR REPLACE FUNCTION trigger_enrichment_queue_processor()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_request_id BIGINT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get Supabase config from environment (set via Vault secrets or ALTER DATABASE)
  -- Run: ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
  -- Run: ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- If not configured via settings, we can't make the call
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Supabase URL or service key not configured. Run: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://YOUR-PROJECT.supabase.co''; ALTER DATABASE postgres SET app.settings.service_role_key = ''YOUR-KEY'';',
      'timestamp', NOW()
    );

    INSERT INTO public.cron_job_logs (job_name, result, created_at)
    VALUES ('process_enrichment_queue', v_result, NOW());

    RETURN v_result;
  END IF;

  -- Make async HTTP POST to edge function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/process-enrichment-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('batchSize', 5)
  ) INTO v_request_id;

  v_result := jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'timestamp', NOW()
  );

  -- Log the trigger
  INSERT INTO public.cron_job_logs (job_name, result, created_at)
  VALUES ('process_enrichment_queue', v_result, NOW());

  RETURN v_result;
END;
$$;

-- =============================================================
-- SCHEDULE CRON JOB FOR ENRICHMENT QUEUE
-- =============================================================

-- Process enrichment queue every 5 minutes
-- This ensures new deals get enriched quickly
SELECT cron.schedule(
  'process-enrichment-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT trigger_enrichment_queue_processor()$$
);

-- =============================================================
-- ALTERNATIVE: Direct queue processing in SQL (no edge function needed)
-- This is a simpler approach that processes queue directly in Postgres
-- =============================================================

CREATE OR REPLACE FUNCTION process_enrichment_queue_direct(batch_size INTEGER DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_processed INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Get pending items and mark them as processing
  -- This just marks them - actual enrichment still needs edge function
  FOR v_item IN
    UPDATE public.enrichment_queue
    SET
      status = 'processing',
      started_at = NOW(),
      attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM public.enrichment_queue
      WHERE status = 'pending' AND attempts < 3
      ORDER BY queued_at ASC
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  LOOP
    v_processed := v_processed + 1;

    -- Note: The actual enrichment is handled by the edge function
    -- This just prepares items for processing
    RAISE NOTICE 'Marked listing % for enrichment (attempt %)', v_item.listing_id, v_item.attempts;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'items_marked', v_processed,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$;

-- =============================================================
-- CREATE VIEW FOR MONITORING ENRICHMENT QUEUE
-- =============================================================

CREATE OR REPLACE VIEW public.enrichment_queue_status AS
SELECT
  eq.id,
  eq.listing_id,
  l.title AS listing_title,
  l.internal_company_name,
  l.website,
  eq.status,
  eq.attempts,
  eq.queued_at,
  eq.started_at,
  eq.completed_at,
  eq.last_error,
  CASE
    WHEN eq.status = 'pending' THEN 'Waiting'
    WHEN eq.status = 'processing' THEN 'In Progress'
    WHEN eq.status = 'completed' THEN 'Done'
    WHEN eq.status = 'failed' THEN 'Failed (max retries)'
    ELSE eq.status
  END AS status_display
FROM public.enrichment_queue eq
JOIN public.listings l ON eq.listing_id = l.id
ORDER BY eq.queued_at DESC;

-- Grant access
GRANT SELECT ON public.enrichment_queue_status TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_enrichment_queue_processor() TO authenticated;
GRANT EXECUTE ON FUNCTION process_enrichment_queue_direct(INTEGER) TO authenticated;

COMMENT ON FUNCTION trigger_enrichment_queue_processor() IS 'Triggers the enrichment queue processor edge function via HTTP';
COMMENT ON FUNCTION process_enrichment_queue_direct(INTEGER) IS 'Marks pending enrichment items for processing';
COMMENT ON VIEW public.enrichment_queue_status IS 'View for monitoring enrichment queue status';
