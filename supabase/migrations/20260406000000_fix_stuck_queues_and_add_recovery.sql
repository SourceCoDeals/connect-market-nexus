-- Fix: Clean up stuck queue items from the timeout mismatch bug.
--
-- Root cause: All 4 queue processor edge functions had MAX_FUNCTION_RUNTIME_MS=140s
-- but Supabase hard-kills edge functions at ~60s. Functions got killed mid-processing,
-- leaving items permanently stuck in "processing"/"running" status.
-- The stale recovery window (5min) was longer than the frontend polling timeout (3min),
-- so the UI froze every time.
--
-- This migration:
-- 1. Recovers any currently stuck scoring queue items
-- 2. Recovers any currently stuck global activity queue operations
-- 3. Recovers any currently stuck buyer enrichment queue items
-- 4. Recovers any currently stuck enrichment (deal) queue items
-- 5. Adds a reusable RPC function for on-demand stale recovery
-- 6. Resets stale rate limit concurrent counters

-- ────────────────────────────────────────────────────────────────────────
-- 1. remarketing_scoring_queue: Reset stuck "processing" items to "pending"
-- ────────────────────────────────────────────────────────────────────────
UPDATE remarketing_scoring_queue
SET status = 'pending',
    attempts = LEAST(attempts, 2)  -- allow at least 1 more retry
WHERE status = 'processing'
  AND (updated_at < now() - interval '2 minutes'
       OR updated_at IS NULL);

-- ────────────────────────────────────────────────────────────────────────
-- 2. global_activity_queue: Fail any operations stuck in "running" for 10+ minutes
--    with 0 completed items (clearly never made progress before being killed)
-- ────────────────────────────────────────────────────────────────────────
UPDATE global_activity_queue
SET status = 'failed',
    completed_at = now(),
    error_log = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
      'Auto-failed by migration: stuck in running state with 0 progress (timeout mismatch bug)'
    )
WHERE status = 'running'
  AND COALESCE(completed_items, 0) = 0
  AND (started_at < now() - interval '10 minutes'
       OR (started_at IS NULL AND created_at < now() - interval '10 minutes'));

-- Also fail "paused" operations that have been paused for over 1 hour
-- (these are likely abandoned)
UPDATE global_activity_queue
SET status = 'failed',
    completed_at = now(),
    error_log = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
      'Auto-failed by migration: paused for over 1 hour with no resumption'
    )
WHERE status = 'paused'
  AND started_at < now() - interval '1 hour';

-- ────────────────────────────────────────────────────────────────────────
-- 3. buyer_enrichment_queue: Reset stuck "processing" items to "pending"
-- ────────────────────────────────────────────────────────────────────────
UPDATE buyer_enrichment_queue
SET status = 'pending',
    started_at = NULL,
    attempts = LEAST(attempts, 2)
WHERE status = 'processing'
  AND (started_at < now() - interval '2 minutes'
       OR started_at IS NULL);

-- ────────────────────────────────────────────────────────────────────────
-- 4. enrichment_queue (deals): Reset stuck "processing" items to "pending"
-- ────────────────────────────────────────────────────────────────────────
UPDATE enrichment_queue
SET status = 'pending',
    started_at = NULL,
    attempts = LEAST(attempts, 2)
WHERE status = 'processing'
  AND (started_at < now() - interval '2 minutes'
       OR started_at IS NULL);

-- ────────────────────────────────────────────────────────────────────────
-- 5. Reset stale rate limit concurrent counters
--    (if a function was killed, it never decremented its concurrent count)
-- ────────────────────────────────────────────────────────────────────────
UPDATE enrichment_rate_limits
SET concurrent_requests = 0,
    updated_at = now()
WHERE concurrent_requests > 0
  AND updated_at < now() - interval '5 minutes';

-- ────────────────────────────────────────────────────────────────────────
-- 6. Reusable RPC: recover_stale_queue_items
--    Can be called on-demand from the admin UI or from queue processors
--    as a safety net. Recovers stuck items across ALL queue tables.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recover_stale_queue_items(
  p_stale_minutes integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff timestamptz;
  v_scoring_count integer := 0;
  v_buyer_enrich_count integer := 0;
  v_deal_enrich_count integer := 0;
  v_global_count integer := 0;
  v_rate_limit_count integer := 0;
BEGIN
  v_cutoff := now() - (p_stale_minutes || ' minutes')::interval;

  -- Scoring queue
  WITH updated AS (
    UPDATE remarketing_scoring_queue
    SET status = 'pending',
        attempts = LEAST(attempts, 2)
    WHERE status = 'processing'
      AND (updated_at < v_cutoff OR updated_at IS NULL)
    RETURNING id
  )
  SELECT count(*) INTO v_scoring_count FROM updated;

  -- Buyer enrichment queue
  WITH updated AS (
    UPDATE buyer_enrichment_queue
    SET status = 'pending',
        started_at = NULL,
        attempts = LEAST(attempts, 2)
    WHERE status = 'processing'
      AND (started_at < v_cutoff OR started_at IS NULL)
    RETURNING id
  )
  SELECT count(*) INTO v_buyer_enrich_count FROM updated;

  -- Deal enrichment queue
  WITH updated AS (
    UPDATE enrichment_queue
    SET status = 'pending',
        started_at = NULL,
        attempts = LEAST(attempts, 2)
    WHERE status = 'processing'
      AND (started_at < v_cutoff OR started_at IS NULL)
    RETURNING id
  )
  SELECT count(*) INTO v_deal_enrich_count FROM updated;

  -- Global activity queue (fail stuck "running" with 0 progress)
  WITH updated AS (
    UPDATE global_activity_queue
    SET status = 'failed',
        completed_at = now(),
        error_log = COALESCE(error_log, '[]'::jsonb) || jsonb_build_array(
          format('Auto-failed by recover_stale_queue_items: 0 progress after %s minutes', p_stale_minutes)
        )
    WHERE status = 'running'
      AND COALESCE(completed_items, 0) = 0
      AND (started_at < v_cutoff
           OR (started_at IS NULL AND created_at < v_cutoff))
    RETURNING id
  )
  SELECT count(*) INTO v_global_count FROM updated;

  -- Rate limit concurrent counters
  WITH updated AS (
    UPDATE enrichment_rate_limits
    SET concurrent_requests = 0,
        updated_at = now()
    WHERE concurrent_requests > 0
      AND updated_at < v_cutoff
    RETURNING provider
  )
  SELECT count(*) INTO v_rate_limit_count FROM updated;

  RETURN jsonb_build_object(
    'scoring_queue_recovered', v_scoring_count,
    'buyer_enrichment_recovered', v_buyer_enrich_count,
    'deal_enrichment_recovered', v_deal_enrich_count,
    'global_queue_failed', v_global_count,
    'rate_limits_reset', v_rate_limit_count,
    'stale_minutes', p_stale_minutes
  );
END;
$$;

COMMENT ON FUNCTION public.recover_stale_queue_items IS
  'Recovers stuck queue items across all processing queues. Call with default 2-minute threshold, or pass custom minutes. Safe to call repeatedly.';
