-- Optimize database queries by eliminating N+1 patterns and adding efficient views
-- These views pre-join related data for common query patterns

-- ============= OPTIMIZED LISTINGS VIEW =============

/**
 * Comprehensive listings view with all related data pre-joined
 * Eliminates N+1 queries when fetching listings with enrichment status
 */
CREATE OR REPLACE VIEW listings_with_enrichment AS
SELECT
  l.id,
  l.company_name,
  l.industry,
  l.status,
  l.created_at,
  l.updated_at,
  l.universe_id,

  -- Universe info (if linked)
  u.name as universe_name,

  -- Enrichment status from queue
  eq.status as enrichment_status,
  eq.priority as enrichment_priority,
  eq.started_at as enrichment_started_at,
  eq.completed_at as enrichment_completed_at,
  eq.error_count as enrichment_error_count,

  -- Industry fit score (if calculated)
  ifs.fit_score,
  ifs.confidence_score as fit_confidence,
  ifs.reasoning as fit_reasoning,

  -- Ranking position (if universe has rankings)
  rr.rank as universe_rank,
  rr.score as rank_score

FROM listings l

-- LEFT JOIN to universe (optional)
LEFT JOIN remarketing_universes u ON u.id = l.universe_id

-- LEFT JOIN to enrichment queue (may not exist)
LEFT JOIN LATERAL (
  SELECT *
  FROM enrichment_queue
  WHERE enrichment_queue.listing_id = l.id
  ORDER BY created_at DESC
  LIMIT 1
) eq ON true

-- LEFT JOIN to industry fit scores (may not exist)
LEFT JOIN LATERAL (
  SELECT *
  FROM industry_fit_scores
  WHERE industry_fit_scores.listing_id = l.id
    AND (l.universe_id IS NULL OR industry_fit_scores.universe_id = l.universe_id)
  ORDER BY created_at DESC
  LIMIT 1
) ifs ON true

-- LEFT JOIN to ranking results (may not exist)
LEFT JOIN LATERAL (
  SELECT
    (ranking_data->i::text->>'rank')::integer as rank,
    (ranking_data->i::text->>'score')::numeric as score
  FROM ranking_results rr,
       generate_series(0, jsonb_array_length(rr.ranking_data) - 1) as i
  WHERE rr.universe_id = l.universe_id
    AND (rr.ranking_data->i::text->>'listing_id')::uuid = l.id
  ORDER BY rr.created_at DESC
  LIMIT 1
) rr ON true;

COMMENT ON VIEW listings_with_enrichment IS
  'Optimized listings view with all related data pre-joined. Use this instead of multiple queries to avoid N+1 patterns.';

-- Create index on listings universe_id for faster JOINs
CREATE INDEX IF NOT EXISTS idx_listings_universe_id_lookup ON listings(universe_id) WHERE universe_id IS NOT NULL;

-- ============= OPTIMIZED UNIVERSES VIEW =============

/**
 * Comprehensive universes view with aggregated statistics
 * Eliminates need for separate count queries
 */
CREATE OR REPLACE VIEW universes_with_stats AS
SELECT
  u.id,
  u.name,
  u.description,
  u.created_at,
  u.updated_at,
  u.archived_at,

  -- Criteria info
  u.size_criteria,
  u.service_criteria,
  u.geography_criteria,
  u.buyer_types_criteria,

  -- Aggregated counts
  COALESCE(listing_counts.total_listings, 0) as total_listings,
  COALESCE(listing_counts.active_listings, 0) as active_listings,
  COALESCE(listing_counts.enriched_listings, 0) as enriched_listings,

  -- Guide generation status
  guide_status.guide_generation_status,
  guide_status.guide_generated_at,
  guide_status.guide_phases_completed,
  guide_status.guide_total_phases,

  -- Criteria extraction status
  criteria_status.criteria_extraction_status,
  criteria_status.criteria_extracted_at,
  criteria_status.criteria_confidence,

  -- Latest ranking
  ranking_info.latest_ranking_at,
  ranking_info.ranking_count

FROM remarketing_universes u

-- LEFT JOIN for listing counts
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) as total_listings,
    COUNT(*) FILTER (WHERE status = 'active') as active_listings,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM enrichment_queue eq
      WHERE eq.listing_id = l.id AND eq.status = 'completed'
    )) as enriched_listings
  FROM listings l
  WHERE l.universe_id = u.id
) listing_counts ON true

-- LEFT JOIN for latest guide generation
LEFT JOIN LATERAL (
  SELECT
    status as guide_generation_status,
    completed_at as guide_generated_at,
    phases_completed as guide_phases_completed,
    total_phases as guide_total_phases
  FROM ma_guide_generations mg
  WHERE mg.universe_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) guide_status ON true

-- LEFT JOIN for latest criteria extraction
LEFT JOIN LATERAL (
  SELECT
    status as criteria_extraction_status,
    completed_at as criteria_extracted_at,
    (confidence_scores->>'overall')::numeric as criteria_confidence
  FROM buyer_criteria_extractions bce
  WHERE bce.universe_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) criteria_status ON true

-- LEFT JOIN for ranking info
LEFT JOIN LATERAL (
  SELECT
    MAX(created_at) as latest_ranking_at,
    COUNT(*) as ranking_count
  FROM ranking_results rr
  WHERE rr.universe_id = u.id
) ranking_info ON true;

COMMENT ON VIEW universes_with_stats IS
  'Optimized universes view with aggregated statistics. Use this to display universe lists with counts.';

-- ============= BATCH FETCH FUNCTIONS =============

/**
 * Batch fetch listings by IDs with all related data
 * More efficient than individual queries
 */
CREATE OR REPLACE FUNCTION get_listings_batch(listing_ids uuid[])
RETURNS TABLE(
  id uuid,
  company_name text,
  industry text,
  status text,
  universe_id uuid,
  universe_name text,
  fit_score numeric,
  enrichment_status text,
  universe_rank integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    company_name,
    industry,
    status,
    universe_id,
    universe_name,
    fit_score,
    enrichment_status,
    universe_rank
  FROM listings_with_enrichment
  WHERE id = ANY(listing_ids);
$$;

COMMENT ON FUNCTION get_listings_batch IS
  'Efficiently fetch multiple listings with all related data. Use this instead of individual queries.';

/**
 * Batch fetch industry fit scores for multiple listing-universe pairs
 */
CREATE OR REPLACE FUNCTION get_fit_scores_batch(
  listing_ids uuid[],
  universe_id_param uuid
)
RETURNS TABLE(
  listing_id uuid,
  fit_score numeric,
  confidence_score numeric,
  reasoning jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (ifs.listing_id)
    ifs.listing_id,
    ifs.fit_score,
    ifs.confidence_score,
    ifs.reasoning
  FROM industry_fit_scores ifs
  WHERE
    ifs.listing_id = ANY(listing_ids)
    AND ifs.universe_id = universe_id_param
  ORDER BY ifs.listing_id, ifs.created_at DESC;
$$;

COMMENT ON FUNCTION get_fit_scores_batch IS
  'Efficiently fetch fit scores for multiple listings in a universe. Avoids N+1 queries.';

-- ============= MATERIALIZED VIEW FOR HEAVY QUERIES =============

/**
 * Materialized view for universe statistics
 * Refresh periodically for better performance on dashboards
 */
CREATE MATERIALIZED VIEW IF NOT EXISTS universe_stats_materialized AS
SELECT
  u.id as universe_id,
  u.name as universe_name,
  COUNT(DISTINCT l.id) as total_listings,
  COUNT(DISTINCT l.id) FILTER (WHERE ifs.fit_score > 70) as high_fit_listings,
  COUNT(DISTINCT l.id) FILTER (WHERE ifs.fit_score > 50 AND ifs.fit_score <= 70) as medium_fit_listings,
  COUNT(DISTINCT l.id) FILTER (WHERE ifs.fit_score <= 50) as low_fit_listings,
  ROUND(AVG(ifs.fit_score), 2) as avg_fit_score,
  MAX(ifs.fit_score) as max_fit_score,
  MIN(ifs.fit_score) as min_fit_score,
  COUNT(DISTINCT mg.id) FILTER (WHERE mg.status = 'completed') as guides_generated,
  COUNT(DISTINCT bce.id) FILTER (WHERE bce.status = 'completed') as criteria_extracted,
  MAX(rr.created_at) as last_ranked_at,
  NOW() as refreshed_at
FROM remarketing_universes u
LEFT JOIN listings l ON l.universe_id = u.id
LEFT JOIN industry_fit_scores ifs ON ifs.listing_id = l.id AND ifs.universe_id = u.id
LEFT JOIN ma_guide_generations mg ON mg.universe_id = u.id
LEFT JOIN buyer_criteria_extractions bce ON bce.universe_id = u.id
LEFT JOIN ranking_results rr ON rr.universe_id = u.id
WHERE u.archived_at IS NULL
GROUP BY u.id, u.name;

-- Create unique index for faster refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_universe_stats_mat_universe_id
  ON universe_stats_materialized(universe_id);

COMMENT ON MATERIALIZED VIEW universe_stats_materialized IS
  'Pre-computed universe statistics for dashboard queries. Refresh every 5 minutes via cron.';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_universe_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY universe_stats_materialized;
  RAISE NOTICE 'Refreshed universe statistics materialized view';
END;
$$;

-- Schedule materialized view refresh every 5 minutes
SELECT cron.schedule(
  'refresh-universe-stats',
  '*/5 * * * *',
  $$SELECT refresh_universe_stats();$$
);

-- ============= QUERY HINTS AND OPTIMIZATIONS =============

-- Add composite index for common JOIN patterns
CREATE INDEX IF NOT EXISTS idx_industry_fit_listing_universe_created
  ON industry_fit_scores(listing_id, universe_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_listing_status_created
  ON enrichment_queue(listing_id, status, created_at DESC);

-- Analyze tables to update query planner statistics
ANALYZE listings;
ANALYZE remarketing_universes;
ANALYZE industry_fit_scores;
ANALYZE enrichment_queue;
ANALYZE ma_guide_generations;
ANALYZE buyer_criteria_extractions;
ANALYZE ranking_results;
