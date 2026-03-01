-- One-time cleanup of stuck queue items + reusable RPC

-- 1. remarketing_scoring_queue — reset stuck "processing" → "pending"
UPDATE public.remarketing_scoring_queue
SET status     = 'pending',
    attempts   = attempts + 1,
    last_error = COALESCE(last_error || ' | ', '') || 'auto-recovered stuck processing at ' || now()::text,
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - INTERVAL '2 minutes';

-- 2. global_activity_queue — fail stuck "running" with 0 progress
UPDATE public.global_activity_queue
SET status       = 'failed',
    completed_at = now(),
    error_log    = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'error', 'auto-recovered: stuck running with 0 progress for 10+ minutes',
        'recovered_at', now()::text
      )
    )
WHERE status = 'running'
  AND completed_items = 0
  AND started_at < now() - INTERVAL '10 minutes';

-- 3. global_activity_queue — fail abandoned "paused" ops
UPDATE public.global_activity_queue
SET status       = 'failed',
    completed_at = now(),
    error_log    = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'error', 'auto-recovered: abandoned in paused state for 1+ hour',
        'recovered_at', now()::text
      )
    )
WHERE status = 'paused'
  AND started_at < now() - INTERVAL '1 hour';

-- 4. buyer_enrichment_queue — reset stuck "processing" → "pending"
UPDATE public.buyer_enrichment_queue
SET status     = 'pending',
    attempts   = attempts + 1,
    last_error = COALESCE(last_error || ' | ', '') || 'auto-recovered stuck processing at ' || now()::text,
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - INTERVAL '2 minutes';

-- 5. enrichment_queue — reset stuck "processing" → "pending"
UPDATE public.enrichment_queue
SET status     = 'pending',
    attempts   = attempts + 1,
    last_error = COALESCE(last_error || ' | ', '') || 'auto-recovered stuck processing at ' || now()::text,
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - INTERVAL '2 minutes';

-- 6. enrichment_rate_limits — reset stale concurrent counters
UPDATE public.enrichment_rate_limits
SET concurrent_requests = 0,
    updated_at          = now()
WHERE concurrent_requests > 0
  AND updated_at < now() - INTERVAL '5 minutes';

-- 7. Reusable RPC: recover_stale_queue_items(stale_minutes)
CREATE OR REPLACE FUNCTION public.recover_stale_queue_items(
  stale_minutes INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scoring_count      INTEGER := 0;
  v_gaq_running_count  INTEGER := 0;
  v_gaq_paused_count   INTEGER := 0;
  v_buyer_count        INTEGER := 0;
  v_enrichment_count   INTEGER := 0;
  v_rate_limit_count   INTEGER := 0;
  v_cutoff             TIMESTAMPTZ;
BEGIN
  v_cutoff := now() - (stale_minutes || ' minutes')::INTERVAL;

  WITH recovered AS (
    UPDATE remarketing_scoring_queue
    SET status     = 'pending',
        attempts   = attempts + 1,
        last_error = COALESCE(last_error || ' | ', '') || 'rpc-recovered at ' || now()::text,
        updated_at = now()
    WHERE status = 'processing'
      AND updated_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_scoring_count FROM recovered;

  WITH recovered AS (
    UPDATE global_activity_queue
    SET status       = 'failed',
        completed_at = now(),
        error_log    = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'error', 'rpc-recovered: stuck running with 0 progress',
            'recovered_at', now()::text
          )
        )
    WHERE status = 'running'
      AND completed_items = 0
      AND started_at < now() - (stale_minutes * 5 || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_gaq_running_count FROM recovered;

  WITH recovered AS (
    UPDATE global_activity_queue
    SET status       = 'failed',
        completed_at = now(),
        error_log    = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'error', 'rpc-recovered: abandoned paused state',
            'recovered_at', now()::text
          )
        )
    WHERE status = 'paused'
      AND started_at < now() - (stale_minutes * 30 || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT count(*) INTO v_gaq_paused_count FROM recovered;

  WITH recovered AS (
    UPDATE buyer_enrichment_queue
    SET status     = 'pending',
        attempts   = attempts + 1,
        last_error = COALESCE(last_error || ' | ', '') || 'rpc-recovered at ' || now()::text,
        updated_at = now()
    WHERE status = 'processing'
      AND updated_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_buyer_count FROM recovered;

  WITH recovered AS (
    UPDATE enrichment_queue
    SET status     = 'pending',
        attempts   = attempts + 1,
        last_error = COALESCE(last_error || ' | ', '') || 'rpc-recovered at ' || now()::text,
        updated_at = now()
    WHERE status = 'processing'
      AND updated_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_enrichment_count FROM recovered;

  WITH recovered AS (
    UPDATE enrichment_rate_limits
    SET concurrent_requests = 0,
        updated_at          = now()
    WHERE concurrent_requests > 0
      AND updated_at < now() - (stale_minutes * 2.5 || ' minutes')::INTERVAL
    RETURNING provider
  )
  SELECT count(*) INTO v_rate_limit_count FROM recovered;

  RETURN jsonb_build_object(
    'recovered_at',                  now(),
    'stale_minutes',                 stale_minutes,
    'remarketing_scoring_queue',     v_scoring_count,
    'global_activity_queue_running', v_gaq_running_count,
    'global_activity_queue_paused',  v_gaq_paused_count,
    'buyer_enrichment_queue',        v_buyer_count,
    'enrichment_queue',              v_enrichment_count,
    'enrichment_rate_limits',        v_rate_limit_count,
    'total_recovered',               v_scoring_count + v_gaq_running_count + v_gaq_paused_count
                                       + v_buyer_count + v_enrichment_count + v_rate_limit_count
  );
END;
$$;

COMMENT ON FUNCTION public.recover_stale_queue_items IS
  'Recovers stuck items across all queue tables. Safe to call repeatedly (idempotent). '
  'Default stale_minutes=2 matches STALE_PROCESSING_MINUTES in edge functions. '
  'Call from admin UI or cron: SELECT recover_stale_queue_items();';