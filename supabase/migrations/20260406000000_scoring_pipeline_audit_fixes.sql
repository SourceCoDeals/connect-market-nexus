-- =============================================================================
-- Scoring Pipeline Audit Fixes
-- Migration: 20260406000000_scoring_pipeline_audit_fixes.sql
-- Source: AUDIT_BUYER_SCORING_PIPELINE.md (2026-03-01)
--
-- Fixes applied:
--   1. Add started_at column to remarketing_scoring_queue for accurate stale detection
--   2. Add scoring_run tracking table for frontend progress visibility
--   3. Add cron-based backup trigger for process-scoring-queue
--   4. Add helper RPCs for real-time progress queries
--   5. Index improvements for polling performance
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. remarketing_scoring_queue: Add started_at for stale detection
--
-- The queue processor currently uses created_at as a heuristic for stale
-- detection (BUG-2 comment in process-scoring-queue/index.ts). This is
-- inaccurate: an item created 10 minutes ago but only started processing
-- 30 seconds ago is incorrectly recovered.
--
-- Adding started_at lets us measure actual processing duration.
-- ---------------------------------------------------------------------------

ALTER TABLE public.remarketing_scoring_queue
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.remarketing_scoring_queue.started_at IS
  'Timestamp when the queue processor began processing this item. Used for stale detection.';

-- Index for stale item recovery queries (replaces the created_at heuristic)
CREATE INDEX IF NOT EXISTS idx_scoring_queue_stale_recovery
  ON public.remarketing_scoring_queue (status, started_at)
  WHERE status = 'processing';


-- ---------------------------------------------------------------------------
-- 2. scoring_runs: Track scoring runs for frontend progress display
--
-- The frontend currently shows a fake progress bar (jumps to 65% and stays).
-- This table lets the auto-score trigger register a "run" with expected totals
-- so the frontend can show "15 of 50 buyers scored" in real time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,

  -- Progress counters
  total_buyers INTEGER NOT NULL DEFAULT 0,
  scored_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,

  -- State machine
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'timed_out')),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Who or what started this run
  triggered_by TEXT NOT NULL DEFAULT 'auto'
    CHECK (triggered_by IN ('auto', 'manual', 'cron', 'retry'))
);

-- Fast lookups by listing for the frontend polling query
CREATE INDEX IF NOT EXISTS idx_scoring_runs_listing_status
  ON public.scoring_runs (listing_id, status)
  WHERE status = 'running';

-- Cleanup: auto-expire stale runs older than 30 minutes
CREATE INDEX IF NOT EXISTS idx_scoring_runs_stale
  ON public.scoring_runs (status, started_at)
  WHERE status = 'running';

-- Enable realtime so the frontend can subscribe instead of polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.scoring_runs;

-- RLS: admins can manage, authenticated can read
ALTER TABLE public.scoring_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scoring runs"
  ON public.scoring_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage scoring runs"
  ON public.scoring_runs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ));

COMMENT ON TABLE public.scoring_runs IS
  'Tracks in-flight scoring runs so the frontend can display real progress (X of Y scored).';


-- ---------------------------------------------------------------------------
-- 3. RPC: get_scoring_progress
--
-- Single-query progress check for the frontend. Returns the latest active
-- scoring run for a listing, or the most recent completed run.
-- Replaces the dual polling of remarketing_scores + remarketing_scoring_queue.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_scoring_progress(p_listing_id UUID)
RETURNS TABLE (
  run_id UUID,
  status TEXT,
  total_buyers INTEGER,
  scored_count INTEGER,
  failed_count INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_pct INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id AS run_id,
    sr.status,
    sr.total_buyers,
    sr.scored_count,
    sr.failed_count,
    sr.started_at,
    sr.completed_at,
    CASE
      WHEN sr.total_buyers = 0 THEN 0
      ELSE LEAST(100, ((sr.scored_count + sr.failed_count) * 100) / sr.total_buyers)
    END AS progress_pct
  FROM scoring_runs sr
  WHERE sr.listing_id = p_listing_id
  ORDER BY
    CASE WHEN sr.status = 'running' THEN 0 ELSE 1 END,
    sr.started_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scoring_progress TO authenticated;

COMMENT ON FUNCTION public.get_scoring_progress IS
  'Returns the current or most recent scoring run progress for a listing. Used by frontend for real progress display.';


-- ---------------------------------------------------------------------------
-- 4. RPC: increment_scoring_run_progress
--
-- Called by score-buyer-deal after each batch to update the run's counters.
-- Atomic increment avoids race conditions when multiple batches complete.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_scoring_run_progress(
  p_listing_id UUID,
  p_scored_delta INTEGER DEFAULT 0,
  p_failed_delta INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scoring_runs
  SET
    scored_count = scored_count + p_scored_delta,
    failed_count = failed_count + p_failed_delta,
    -- Auto-complete when all buyers are accounted for
    status = CASE
      WHEN (scored_count + p_scored_delta + failed_count + p_failed_delta) >= total_buyers
        THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN (scored_count + p_scored_delta + failed_count + p_failed_delta) >= total_buyers
        THEN now()
      ELSE completed_at
    END
  WHERE listing_id = p_listing_id
    AND status = 'running';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_scoring_run_progress TO service_role;

COMMENT ON FUNCTION public.increment_scoring_run_progress IS
  'Atomically increments scored/failed counts on the active scoring run for a listing. Called by score-buyer-deal after each batch.';


-- ---------------------------------------------------------------------------
-- 5. RPC: expire_stale_scoring_runs
--
-- Auto-expire scoring runs stuck in 'running' for more than 15 minutes.
-- Called by process-scoring-queue at startup.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_scoring_runs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE scoring_runs
  SET
    status = 'timed_out',
    completed_at = now()
  WHERE status = 'running'
    AND started_at < now() - INTERVAL '15 minutes';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_scoring_runs TO service_role;


-- ---------------------------------------------------------------------------
-- 6. Index improvements for frontend polling performance
--
-- The useRecommendedBuyers hook polls remarketing_scores filtered by
-- listing_id + is_disqualified + ordered by composite_score DESC.
-- This composite index covers that exact query pattern.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_remarketing_scores_listing_active
  ON public.remarketing_scores (listing_id, composite_score DESC)
  WHERE is_disqualified IS NOT TRUE;

-- The auto-score trigger checks "has any scores for this listing?"
-- A covering index on (listing_id) with a partial filter makes this O(1).
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_listing_exists
  ON public.remarketing_scores (listing_id)
  WHERE is_disqualified IS NOT TRUE;


-- ---------------------------------------------------------------------------
-- 7. Add serper to enrichment_rate_limits if missing
--
-- The rate-limiter.ts TypeScript code references 'serper' as a provider
-- but the initial seed data only inserted: anthropic, gemini, openai,
-- firecrawl, apify. Add serper for completeness.
-- ---------------------------------------------------------------------------

INSERT INTO public.enrichment_rate_limits (provider)
VALUES ('serper')
ON CONFLICT (provider) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 8. Buyer learning history: add index for the learning phase
--
-- phases/learning.ts queries buyer_learning_history by buyer_id.
-- Ensure an index exists for fast lookups.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_buyer_learning_history_buyer
  ON public.buyer_learning_history (buyer_id)
  WHERE buyer_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 9. deal_scoring_adjustments: add index for custom instruction lookups
--
-- The scoring pipeline queries deal_scoring_adjustments by listing_id
-- during composite assembly. Ensure an index exists.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_deal_scoring_adjustments_listing
  ON public.deal_scoring_adjustments (listing_id)
  WHERE listing_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 10. Score staleness helper
--
-- RPC to check if scores for a listing are fresh (< N hours old).
-- Prevents unnecessary re-scoring when the user navigates back to a tab
-- that already has recent scores.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_scores_freshness(
  p_listing_id UUID,
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  has_scores BOOLEAN,
  score_count INTEGER,
  oldest_score_age_hours NUMERIC,
  is_fresh BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) > 0 AS has_scores,
    COUNT(*)::INTEGER AS score_count,
    COALESCE(
      EXTRACT(EPOCH FROM (now() - MIN(rs.scored_at))) / 3600.0,
      0
    )::NUMERIC AS oldest_score_age_hours,
    CASE
      WHEN COUNT(*) = 0 THEN false
      WHEN MIN(rs.scored_at) IS NULL THEN false
      WHEN MIN(rs.scored_at) > now() - (p_max_age_hours || ' hours')::INTERVAL THEN true
      ELSE false
    END AS is_fresh
  FROM remarketing_scores rs
  WHERE rs.listing_id = p_listing_id
    AND (rs.is_disqualified IS NOT TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_scores_freshness TO authenticated;

COMMENT ON FUNCTION public.check_scores_freshness IS
  'Returns score freshness info for a listing. Frontend uses this to decide whether to trigger auto-scoring. Prevents redundant scoring runs.';
