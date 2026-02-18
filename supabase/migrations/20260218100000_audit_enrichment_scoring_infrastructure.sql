-- ============================================================================
-- CTO Audit Infrastructure: Enrichment Jobs, Observability, Score Snapshots
--
-- Implements recommendations from the Feb 17, 2026 CTO audit:
--   4.1.2 Persist Enrichment Job State
--   4.2.2 Score Snapshots (immutable audit trail)
--   4.3.1 Enrichment Event Logging (API success rate by source)
--   4.2.2 Scoring Weights History (version tracking)
-- ============================================================================

-- ============================================================================
-- 1. ENRICHMENT JOBS - Batch job tracking with resumption support
-- Audit 4.1.2: "Create an enrichment_jobs table to track progress"
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('deal_enrichment', 'buyer_enrichment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused', 'cancelled')),

  -- Progress tracking
  total_records INT NOT NULL DEFAULT 0,
  records_processed INT NOT NULL DEFAULT 0,
  records_succeeded INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  records_skipped INT NOT NULL DEFAULT 0,

  -- Resumption support
  last_processed_id UUID,

  -- Error tracking
  error_summary TEXT,
  error_count INT NOT NULL DEFAULT 0,
  circuit_breaker_tripped BOOLEAN NOT NULL DEFAULT FALSE,

  -- Rate limit tracking
  rate_limit_count INT NOT NULL DEFAULT 0,
  last_rate_limited_at TIMESTAMPTZ,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Who triggered it
  triggered_by UUID REFERENCES auth.users(id),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'scheduled', 'api'))
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_type_created ON enrichment_jobs(job_type, created_at DESC);

-- ============================================================================
-- 2. ENRICHMENT EVENTS - Per-call observability log
-- Audit 4.3.1: "Enrichment Success Rate by Source: Unknown % of Gemini/Claude
-- calls succeed, fail, timeout, or hit rate limits"
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  job_id UUID REFERENCES enrichment_jobs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('deal', 'buyer')),
  entity_id UUID NOT NULL,

  -- Provider call details
  provider TEXT NOT NULL, -- 'gemini', 'firecrawl', 'apify', 'claude'
  function_name TEXT NOT NULL, -- 'enrich-deal', 'extract-deal-transcript', etc.
  step_name TEXT, -- 'transcript_extraction', 'website_scrape', 'ai_extraction', etc.

  -- Outcome
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'timeout', 'rate_limited', 'skipped')),
  error_message TEXT,

  -- Metrics
  duration_ms INT,
  fields_updated INT DEFAULT 0,
  tokens_used INT DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for observability queries
CREATE INDEX IF NOT EXISTS idx_enrichment_events_provider_status ON enrichment_events(provider, status);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_created ON enrichment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_entity ON enrichment_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_events_job ON enrichment_events(job_id) WHERE job_id IS NOT NULL;

-- ============================================================================
-- 3. SCORE SNAPSHOTS - Immutable scoring history
-- Audit 4.2.2: "score_snapshots: deal_id, deal_quality, buyer_fit, engagement
-- — Audit trail of scoring. Immutable history"
-- ============================================================================
CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity references
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  universe_id UUID,

  -- Snapshot of all score components at time of scoring
  composite_score NUMERIC(5,2),
  geography_score NUMERIC(5,2),
  size_score NUMERIC(5,2),
  service_score NUMERIC(5,2),
  owner_goals_score NUMERIC(5,2),
  deal_quality_score NUMERIC(5,2),
  engagement_score NUMERIC(5,2),

  -- Tier at time of scoring
  tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),

  -- Weights used (captured for auditability)
  weights_used JSONB, -- { geography: 35, size: 25, service: 25, owner_goals: 15 }

  -- Multipliers applied
  multipliers_applied JSONB, -- { size_multiplier: 1.0, service_multiplier: 0.8, ... }

  -- Bonuses/penalties
  bonuses_applied JSONB, -- { thesis_bonus: 10, data_quality: 5, learning_penalty: -3 }

  -- Data completeness at scoring time
  data_completeness TEXT CHECK (data_completeness IN ('high', 'medium', 'low')),
  missing_fields JSONB,

  -- Scoring trigger
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'bulk', 'auto', 'recalculation')),
  scoring_version TEXT, -- e.g. 'v5' for tracking algorithm version changes

  -- Immutable timestamp
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for historical analysis
CREATE INDEX IF NOT EXISTS idx_score_snapshots_listing ON score_snapshots(listing_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_buyer ON score_snapshots(buyer_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_scored_at ON score_snapshots(scored_at DESC);

-- ============================================================================
-- 4. SCORING WEIGHTS HISTORY - Track weight configuration changes
-- Audit 4.2.2: "scoring_weights: component, weight, updated_at — Track changes"
-- ============================================================================
CREATE TABLE IF NOT EXISTS scoring_weights_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which universe's weights changed
  universe_id UUID NOT NULL,

  -- Weight values at this point in time
  geography_weight NUMERIC(5,2) NOT NULL,
  size_weight NUMERIC(5,2) NOT NULL,
  service_weight NUMERIC(5,2) NOT NULL,
  owner_goals_weight NUMERIC(5,2) NOT NULL,

  -- Full scoring_behavior snapshot
  scoring_behavior JSONB,

  -- Change metadata
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_weights_history_universe ON scoring_weights_history(universe_id, created_at DESC);

-- ============================================================================
-- 5. MATERIALIZED VIEWS for Dashboard Observability
-- Audit 4.3.2: "Score distribution, enrichment job status, data freshness"
-- ============================================================================

-- 5a. Enrichment success rates by provider (last 7 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_enrichment_provider_stats AS
SELECT
  provider,
  function_name,
  status,
  COUNT(*) AS event_count,
  AVG(duration_ms) AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  SUM(fields_updated) AS total_fields_updated,
  SUM(tokens_used) AS total_tokens_used,
  DATE_TRUNC('hour', created_at) AS hour
FROM enrichment_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider, function_name, status, DATE_TRUNC('hour', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_enrichment_provider_stats
  ON mv_enrichment_provider_stats(provider, function_name, status, hour);

-- 5b. Data freshness heatmap (how stale is enrichment data?)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_data_freshness AS
SELECT
  CASE
    WHEN enriched_at IS NULL THEN 'never_enriched'
    WHEN enriched_at > NOW() - INTERVAL '7 days' THEN 'fresh_7d'
    WHEN enriched_at > NOW() - INTERVAL '30 days' THEN 'stale_30d'
    WHEN enriched_at > NOW() - INTERVAL '90 days' THEN 'stale_90d'
    ELSE 'stale_90d_plus'
  END AS freshness_bucket,
  COUNT(*) AS deal_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - enriched_at)) / 86400)::INT AS avg_age_days
FROM listings
WHERE deleted_at IS NULL
GROUP BY freshness_bucket;

-- 5c. Score distribution histogram
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_score_distribution AS
SELECT
  universe_id,
  CASE
    WHEN composite_score >= 80 THEN 'A (80-100)'
    WHEN composite_score >= 65 THEN 'B (65-79)'
    WHEN composite_score >= 50 THEN 'C (50-64)'
    WHEN composite_score >= 35 THEN 'D (35-49)'
    ELSE 'F (<35)'
  END AS score_band,
  tier,
  COUNT(*) AS match_count,
  AVG(composite_score)::NUMERIC(5,2) AS avg_score,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'passed') AS passed_count,
  -- Score-to-outcome: approval rate per band
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('approved', 'passed')) > 0
    THEN (COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC /
          COUNT(*) FILTER (WHERE status IN ('approved', 'passed'))::NUMERIC * 100)::NUMERIC(5,2)
    ELSE NULL
  END AS approval_rate_pct
FROM remarketing_scores
WHERE is_disqualified = FALSE
GROUP BY universe_id, score_band, tier;

-- Refresh function for cron
CREATE OR REPLACE FUNCTION refresh_audit_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_enrichment_provider_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_data_freshness;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_score_distribution;
END;
$$;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Create or update an enrichment job
CREATE OR REPLACE FUNCTION upsert_enrichment_job(
  p_job_type TEXT,
  p_total_records INT,
  p_triggered_by UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO enrichment_jobs (job_type, status, total_records, triggered_by, source, started_at)
  VALUES (p_job_type, 'processing', p_total_records, p_triggered_by, p_source, NOW())
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- Update enrichment job progress (atomic increment)
CREATE OR REPLACE FUNCTION update_enrichment_job_progress(
  p_job_id UUID,
  p_succeeded_delta INT DEFAULT 0,
  p_failed_delta INT DEFAULT 0,
  p_skipped_delta INT DEFAULT 0,
  p_last_processed_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_rate_limited BOOLEAN DEFAULT FALSE,
  p_circuit_breaker BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    records_processed = records_processed + p_succeeded_delta + p_failed_delta + p_skipped_delta,
    records_succeeded = records_succeeded + p_succeeded_delta,
    records_failed = records_failed + p_failed_delta,
    records_skipped = records_skipped + p_skipped_delta,
    last_processed_id = COALESCE(p_last_processed_id, last_processed_id),
    error_summary = CASE WHEN p_error_message IS NOT NULL THEN p_error_message ELSE error_summary END,
    error_count = error_count + CASE WHEN p_failed_delta > 0 THEN p_failed_delta ELSE 0 END,
    rate_limit_count = rate_limit_count + CASE WHEN p_rate_limited THEN 1 ELSE 0 END,
    last_rate_limited_at = CASE WHEN p_rate_limited THEN NOW() ELSE last_rate_limited_at END,
    circuit_breaker_tripped = CASE WHEN p_circuit_breaker THEN TRUE ELSE circuit_breaker_tripped END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- Complete an enrichment job
CREATE OR REPLACE FUNCTION complete_enrichment_job(
  p_job_id UUID,
  p_status TEXT DEFAULT 'completed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    status = p_status,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- Log an enrichment event
CREATE OR REPLACE FUNCTION log_enrichment_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_provider TEXT,
  p_function_name TEXT,
  p_status TEXT,
  p_step_name TEXT DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL,
  p_fields_updated INT DEFAULT 0,
  p_tokens_used INT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO enrichment_events (
    entity_type, entity_id, provider, function_name, step_name,
    job_id, status, error_message, duration_ms, fields_updated, tokens_used
  )
  VALUES (
    p_entity_type, p_entity_id, p_provider, p_function_name, p_step_name,
    p_job_id, p_status, p_error_message, p_duration_ms, p_fields_updated, p_tokens_used
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- RLS: Allow authenticated users to read, service role to write
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_weights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enrichment_jobs"
  ON enrichment_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage enrichment_jobs"
  ON enrichment_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read enrichment_events"
  ON enrichment_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage enrichment_events"
  ON enrichment_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read score_snapshots"
  ON score_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage score_snapshots"
  ON score_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read scoring_weights_history"
  ON scoring_weights_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage scoring_weights_history"
  ON scoring_weights_history FOR ALL TO service_role USING (true) WITH CHECK (true);
