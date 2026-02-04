-- Add missing database indexes for performance optimization
-- Indexes speed up common queries on filtered and sorted columns

-- ============= LISTINGS TABLE =============

-- Status filtering (very common - used in all list views)
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status) WHERE status IS NOT NULL;

-- Created date sorting (used for "Recent Listings")
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- Combined status + created (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC) WHERE status IS NOT NULL;

-- Industry filtering
CREATE INDEX IF NOT EXISTS idx_listings_industry ON listings(industry) WHERE industry IS NOT NULL;

-- Company name search (partial match support)
CREATE INDEX IF NOT EXISTS idx_listings_company_name_trgm ON listings USING gin(company_name gin_trgm_ops);

-- Universe filtering (for remarketing)
CREATE INDEX IF NOT EXISTS idx_listings_universe_id ON listings(universe_id) WHERE universe_id IS NOT NULL;

-- ============= ENRICHMENT QUEUE TABLE =============

-- Status filtering for queue processing
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status) WHERE status IN ('pending', 'processing');

-- Created date for FIFO processing
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_created_at ON enrichment_queue(created_at ASC);

-- Combined status + priority + created (optimal queue processing)
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_processing ON enrichment_queue(status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'processing');

-- Listing ID lookup
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_listing_id ON enrichment_queue(listing_id);

-- Failed items for retry analysis
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_failed ON enrichment_queue(status, error_count, updated_at)
  WHERE status = 'failed';

-- ============= M&A GUIDE GENERATIONS TABLE =============

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_ma_guide_status ON ma_guide_generations(status);

-- Universe lookup (very common)
CREATE INDEX IF NOT EXISTS idx_ma_guide_universe_id ON ma_guide_generations(universe_id);

-- Combined universe + status (most common query)
CREATE INDEX IF NOT EXISTS idx_ma_guide_universe_status ON ma_guide_generations(universe_id, status);

-- Started date for zombie cleanup
CREATE INDEX IF NOT EXISTS idx_ma_guide_started_at ON ma_guide_generations(started_at)
  WHERE status = 'processing';

-- Completed date for history
CREATE INDEX IF NOT EXISTS idx_ma_guide_completed_at ON ma_guide_generations(completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- ============= BUYER CRITERIA EXTRACTIONS TABLE =============

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_status ON buyer_criteria_extractions(status);

-- Universe lookup
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_universe_id ON buyer_criteria_extractions(universe_id);

-- Combined universe + status
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_universe_status ON buyer_criteria_extractions(universe_id, status);

-- Started date for zombie cleanup
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_started_at ON buyer_criteria_extractions(started_at)
  WHERE status = 'processing';

-- Source lookup
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_source_id ON buyer_criteria_extractions(source_id);

-- ============= REMARKETING UNIVERSES TABLE =============

-- Created date for listing
CREATE INDEX IF NOT EXISTS idx_universes_created_at ON remarketing_universes(created_at DESC);

-- Name search
CREATE INDEX IF NOT EXISTS idx_universes_name_trgm ON remarketing_universes USING gin(name gin_trgm_ops);

-- Active/archived filtering
CREATE INDEX IF NOT EXISTS idx_universes_archived ON remarketing_universes(archived_at)
  WHERE archived_at IS NULL;

-- ============= CRITERIA EXTRACTION SOURCES TABLE =============

-- Universe lookup
CREATE INDEX IF NOT EXISTS idx_extraction_sources_universe_id ON criteria_extraction_sources(universe_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_extraction_sources_status ON criteria_extraction_sources(extraction_status);

-- Created date
CREATE INDEX IF NOT EXISTS idx_extraction_sources_created_at ON criteria_extraction_sources(created_at DESC);

-- ============= INDUSTRY FIT SCORES TABLE =============

-- Listing lookup (for displaying fit scores)
CREATE INDEX IF NOT EXISTS idx_industry_fit_listing_id ON industry_fit_scores(listing_id);

-- Universe lookup (for universe-wide analytics)
CREATE INDEX IF NOT EXISTS idx_industry_fit_universe_id ON industry_fit_scores(universe_id);

-- Combined listing + universe (most common query)
CREATE INDEX IF NOT EXISTS idx_industry_fit_listing_universe ON industry_fit_scores(listing_id, universe_id);

-- Score filtering (for high-fit filtering)
CREATE INDEX IF NOT EXISTS idx_industry_fit_score ON industry_fit_scores(fit_score DESC)
  WHERE fit_score > 50;

-- ============= RANKING RESULTS TABLE =============

-- Universe lookup
CREATE INDEX IF NOT EXISTS idx_ranking_results_universe_id ON ranking_results(universe_id);

-- Created date for history
CREATE INDEX IF NOT EXISTS idx_ranking_results_created_at ON ranking_results(created_at DESC);

-- Combined universe + created (most common query)
CREATE INDEX IF NOT EXISTS idx_ranking_results_universe_created ON ranking_results(universe_id, created_at DESC);

-- ============= ENABLE TRIGRAM EXTENSION =============

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMENT ON EXTENSION pg_trgm IS
  'Trigram matching for fuzzy text search. Used for company name and universe name searches.';

-- ============= INDEX STATISTICS VIEW =============

-- Create view for monitoring index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW index_usage_stats IS
  'Monitor index usage to identify unused indexes. Low scan counts may indicate unnecessary indexes.';

-- ============= ANALYZE TABLES =============

-- Run ANALYZE to update statistics after creating indexes
ANALYZE listings;
ANALYZE enrichment_queue;
ANALYZE ma_guide_generations;
ANALYZE buyer_criteria_extractions;
ANALYZE remarketing_universes;
ANALYZE criteria_extraction_sources;
ANALYZE industry_fit_scores;
ANALYZE ranking_results;
