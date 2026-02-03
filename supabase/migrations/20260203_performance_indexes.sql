-- Migration: Add performance indexes for frequently queried columns
-- These indexes significantly improve query performance on large datasets

-- =============================================================
-- LISTINGS TABLE INDEXES
-- =============================================================

-- Index for filtering by status (most common filter)
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);

-- Index for geographic state searches (used in matching and filtering)
CREATE INDEX IF NOT EXISTS idx_listings_geographic_states ON public.listings USING GIN(geographic_states);

-- Index for date-based queries (recent deals, date filters)
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);

-- Index for enrichment status checks
CREATE INDEX IF NOT EXISTS idx_listings_enriched_at ON public.listings(enriched_at) WHERE enriched_at IS NOT NULL;

-- Composite index for common admin queries (status + created_at)
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON public.listings(status, created_at DESC);

-- Index for revenue/EBITDA range queries
CREATE INDEX IF NOT EXISTS idx_listings_revenue ON public.listings(revenue) WHERE revenue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_ebitda ON public.listings(ebitda) WHERE ebitda IS NOT NULL;

-- =============================================================
-- REMARKETING_SCORES TABLE INDEXES
-- =============================================================

-- Index for composite score (most common sort/filter)
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_composite ON public.remarketing_scores(composite_score DESC);

-- Index for tier-based filtering
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_tier ON public.remarketing_scores(
  CASE
    WHEN composite_score >= 80 THEN 'A'
    WHEN composite_score >= 60 THEN 'B'
    WHEN composite_score >= 40 THEN 'C'
    ELSE 'D'
  END
);

-- Index for status filtering (approved, passed, pending)
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_status ON public.remarketing_scores(status);

-- Composite index for buyer-listing lookups
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_buyer_listing ON public.remarketing_scores(buyer_id, listing_id);

-- Index for universe-based filtering
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_universe ON public.remarketing_scores(universe_id) WHERE universe_id IS NOT NULL;

-- =============================================================
-- REMARKETING_BUYERS TABLE INDEXES
-- =============================================================

-- Index for data completeness filtering
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_completeness ON public.remarketing_buyers(data_completeness);

-- Index for archived status (most queries filter this)
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_archived ON public.remarketing_buyers(archived);

-- Index for geographic footprint searches
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_footprint ON public.remarketing_buyers USING GIN(geographic_footprint);

-- Index for target geographies
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_target_geo ON public.remarketing_buyers USING GIN(target_geographies);

-- Index for buyer type filtering
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_type ON public.remarketing_buyers(buyer_type);

-- Composite for common queries (not archived + completeness)
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_active ON public.remarketing_buyers(archived, data_completeness)
  WHERE archived = false;

-- =============================================================
-- REMARKETING_BUYER_UNIVERSES TABLE INDEXES
-- =============================================================

-- Index for archived filter
CREATE INDEX IF NOT EXISTS idx_remarketing_universes_archived ON public.remarketing_buyer_universes(archived);

-- Index for name searches
CREATE INDEX IF NOT EXISTS idx_remarketing_universes_name ON public.remarketing_buyer_universes(name);

-- =============================================================
-- PROFILES TABLE INDEXES
-- =============================================================

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Index for approval status
CREATE INDEX IF NOT EXISTS idx_profiles_approval ON public.profiles(approval_status);

-- Index for buyer type filtering
CREATE INDEX IF NOT EXISTS idx_profiles_buyer_type ON public.profiles(buyer_type);

-- =============================================================
-- ANALYZE TABLES TO UPDATE STATISTICS
-- =============================================================

ANALYZE public.listings;
ANALYZE public.remarketing_scores;
ANALYZE public.remarketing_buyers;
ANALYZE public.remarketing_buyer_universes;
ANALYZE public.profiles;

COMMENT ON INDEX idx_listings_geographic_states IS 'GIN index for fast geographic_states array searches';
COMMENT ON INDEX idx_remarketing_scores_composite IS 'Index for sorting by composite score (most common operation)';
COMMENT ON INDEX idx_remarketing_buyers_footprint IS 'GIN index for geographic_footprint array searches';
