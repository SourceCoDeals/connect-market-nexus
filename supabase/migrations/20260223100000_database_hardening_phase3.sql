-- ============================================================================
-- DATABASE HARDENING PHASE 3
-- ============================================================================
-- Adds CHECK constraints for domain validation, composite indexes for
-- frequently-joined columns, and GIN indexes for JSONB search columns.
--
-- IDEMPOTENCY: Every constraint uses a DO block that checks pg_constraint
-- before adding. Every index uses CREATE INDEX IF NOT EXISTS.
-- Safe to re-run on any environment.
-- ============================================================================


-- ============================================================================
-- PART 1: CHECK CONSTRAINTS
-- ============================================================================
-- Enforce domain-level data integrity on numeric columns. All constraints
-- allow NULL (nullable columns) but reject invalid values when present.
-- ============================================================================


-- --------------------------------------------------------------------------
-- 1a. listings table — financial and scoring constraints
-- --------------------------------------------------------------------------

-- Revenue must be positive when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_revenue_positive'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_revenue_positive
      CHECK (revenue IS NULL OR revenue > 0);
  END IF;
END $$;

-- EBITDA margin is a percentage (-100% to +100%)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_ebitda_margin_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_ebitda_margin_range
      CHECK (ebitda_margin IS NULL OR (ebitda_margin >= -100 AND ebitda_margin <= 100));
  END IF;
END $$;

-- Customer concentration is a percentage (0-100%)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_customer_concentration_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_customer_concentration_range
      CHECK (customer_concentration IS NULL OR (customer_concentration >= 0 AND customer_concentration <= 100));
  END IF;
END $$;

-- Google rating is 0-5 stars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_google_rating_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_google_rating_range
      CHECK (google_rating IS NULL OR (google_rating >= 0 AND google_rating <= 5));
  END IF;
END $$;

-- Google review count must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_google_review_count_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_google_review_count_nonneg
      CHECK (google_review_count IS NULL OR google_review_count >= 0);
  END IF;
END $$;

-- Employee counts must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_full_time_employees_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_full_time_employees_nonneg
      CHECK (full_time_employees IS NULL OR full_time_employees >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_part_time_employees_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_part_time_employees_nonneg
      CHECK (part_time_employees IS NULL OR part_time_employees >= 0);
  END IF;
END $$;

-- Number of locations must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_number_of_locations_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_number_of_locations_nonneg
      CHECK (number_of_locations IS NULL OR number_of_locations >= 0);
  END IF;
END $$;

-- Founded year must be a reasonable range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_founded_year_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_founded_year_range
      CHECK (founded_year IS NULL OR (founded_year >= 1800 AND founded_year <= 2100));
  END IF;
END $$;

-- Scoring fields must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_deal_size_score_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_deal_size_score_nonneg
      CHECK (deal_size_score IS NULL OR deal_size_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_deal_total_score_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_deal_total_score_nonneg
      CHECK (deal_total_score IS NULL OR deal_total_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_revenue_score_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_revenue_score_range
      CHECK (revenue_score IS NULL OR (revenue_score >= 0 AND revenue_score <= 10));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_ebitda_score_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_ebitda_score_range
      CHECK (ebitda_score IS NULL OR (ebitda_score >= 0 AND ebitda_score <= 10));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_seller_interest_score_range'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_seller_interest_score_range
      CHECK (seller_interest_score IS NULL OR (seller_interest_score >= 0 AND seller_interest_score <= 10));
  END IF;
END $$;

-- LinkedIn employee count must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_linkedin_employee_count_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_linkedin_employee_count_nonneg
      CHECK (linkedin_employee_count IS NULL OR linkedin_employee_count >= 0);
  END IF;
END $$;

-- Team page employee count must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_listings_team_page_employee_count_nonneg'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT chk_listings_team_page_employee_count_nonneg
      CHECK (team_page_employee_count IS NULL OR team_page_employee_count >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1b. deals table — value, probability, scoring constraints
-- --------------------------------------------------------------------------

-- Deal value must be positive when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deals_value_positive'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT chk_deals_value_positive
      CHECK (value IS NULL OR value > 0);
  END IF;
END $$;

-- Probability is a percentage (0-100%)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deals_probability_range'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT chk_deals_probability_range
      CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100));
  END IF;
END $$;

-- Deal score must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deals_deal_score_nonneg'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT chk_deals_deal_score_nonneg
      CHECK (deal_score IS NULL OR deal_score >= 0);
  END IF;
END $$;

-- Buyer priority score must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_deals_buyer_priority_score_nonneg'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT chk_deals_buyer_priority_score_nonneg
      CHECK (buyer_priority_score IS NULL OR buyer_priority_score >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1c. remarketing_scores table — composite and sub-score constraints
-- --------------------------------------------------------------------------

-- Composite score is 0-100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_composite_range'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_composite_range
      CHECK (composite_score >= 0 AND composite_score <= 100);
  END IF;
END $$;

-- Sub-scores must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_geography_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_geography_nonneg
      CHECK (geography_score IS NULL OR geography_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_size_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_size_nonneg
      CHECK (size_score IS NULL OR size_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_service_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_service_nonneg
      CHECK (service_score IS NULL OR service_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_owner_goals_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_owner_goals_nonneg
      CHECK (owner_goals_score IS NULL OR owner_goals_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_portfolio_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_portfolio_nonneg
      CHECK (portfolio_score IS NULL OR portfolio_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_acquisition_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_acquisition_nonneg
      CHECK (acquisition_score IS NULL OR acquisition_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_scores_business_model_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_scores
      ADD CONSTRAINT chk_remarketing_scores_business_model_nonneg
      CHECK (business_model_score IS NULL OR business_model_score >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1d. remarketing_buyers table — target range and alignment constraints
-- --------------------------------------------------------------------------

-- Target revenue must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_target_revenue_min_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_target_revenue_min_nonneg
      CHECK (target_revenue_min IS NULL OR target_revenue_min >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_target_revenue_max_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_target_revenue_max_nonneg
      CHECK (target_revenue_max IS NULL OR target_revenue_max >= 0);
  END IF;
END $$;

-- Target EBITDA must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_target_ebitda_min_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_target_ebitda_min_nonneg
      CHECK (target_ebitda_min IS NULL OR target_ebitda_min >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_target_ebitda_max_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_target_ebitda_max_nonneg
      CHECK (target_ebitda_max IS NULL OR target_ebitda_max >= 0);
  END IF;
END $$;

-- Alignment score is 0-100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_alignment_score_range'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_alignment_score_range
      CHECK (alignment_score IS NULL OR (alignment_score >= 0 AND alignment_score <= 100));
  END IF;
END $$;

-- Total acquisitions must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_remarketing_buyers_total_acquisitions_nonneg'
  ) THEN
    ALTER TABLE public.remarketing_buyers
      ADD CONSTRAINT chk_remarketing_buyers_total_acquisitions_nonneg
      CHECK (total_acquisitions IS NULL OR total_acquisitions >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1e. daily_metrics table — percentage constraints
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_daily_metrics_bounce_rate_range'
  ) THEN
    ALTER TABLE public.daily_metrics
      ADD CONSTRAINT chk_daily_metrics_bounce_rate_range
      CHECK (bounce_rate IS NULL OR (bounce_rate >= 0 AND bounce_rate <= 100));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_daily_metrics_conversion_rate_range'
  ) THEN
    ALTER TABLE public.daily_metrics
      ADD CONSTRAINT chk_daily_metrics_conversion_rate_range
      CHECK (conversion_rate IS NULL OR (conversion_rate >= 0 AND conversion_rate <= 100));
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1f. engagement_scores table — score and percentage constraints
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_engagement_scores_score_nonneg'
  ) THEN
    ALTER TABLE public.engagement_scores
      ADD CONSTRAINT chk_engagement_scores_score_nonneg
      CHECK (score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_engagement_scores_bounce_rate_range'
  ) THEN
    ALTER TABLE public.engagement_scores
      ADD CONSTRAINT chk_engagement_scores_bounce_rate_range
      CHECK (bounce_rate IS NULL OR (bounce_rate >= 0 AND bounce_rate <= 100));
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1g. profiles table — deal size constraints
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_target_deal_size_min_nonneg'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_profiles_target_deal_size_min_nonneg
      CHECK (target_deal_size_min IS NULL OR target_deal_size_min >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_target_deal_size_max_nonneg'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_profiles_target_deal_size_max_nonneg
      CHECK (target_deal_size_max IS NULL OR target_deal_size_max >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1h. valuation_leads table — valuation and scoring constraints
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_revenue_positive'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_revenue_positive
      CHECK (revenue IS NULL OR revenue > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_valuation_low_nonneg'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_valuation_low_nonneg
      CHECK (valuation_low IS NULL OR valuation_low >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_valuation_mid_nonneg'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_valuation_mid_nonneg
      CHECK (valuation_mid IS NULL OR valuation_mid >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_valuation_high_nonneg'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_valuation_high_nonneg
      CHECK (valuation_high IS NULL OR valuation_high >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_lead_score_nonneg'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_lead_score_nonneg
      CHECK (lead_score IS NULL OR lead_score >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_valuation_leads_readiness_score_nonneg'
  ) THEN
    ALTER TABLE public.valuation_leads
      ADD CONSTRAINT chk_valuation_leads_readiness_score_nonneg
      CHECK (readiness_score IS NULL OR readiness_score >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1i. connection_requests table — buyer priority score
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_connection_requests_buyer_priority_nonneg'
  ) THEN
    ALTER TABLE public.connection_requests
      ADD CONSTRAINT chk_connection_requests_buyer_priority_nonneg
      CHECK (buyer_priority_score IS NULL OR buyer_priority_score >= 0);
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1j. enrichment_cost_log table — cost and token constraints
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_cost_log_cost_nonneg'
  ) THEN
    ALTER TABLE public.enrichment_cost_log
      ADD CONSTRAINT chk_enrichment_cost_log_cost_nonneg
      CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_cost_log_input_tokens_nonneg'
  ) THEN
    ALTER TABLE public.enrichment_cost_log
      ADD CONSTRAINT chk_enrichment_cost_log_input_tokens_nonneg
      CHECK (input_tokens IS NULL OR input_tokens >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_cost_log_output_tokens_nonneg'
  ) THEN
    ALTER TABLE public.enrichment_cost_log
      ADD CONSTRAINT chk_enrichment_cost_log_output_tokens_nonneg
      CHECK (output_tokens IS NULL OR output_tokens >= 0);
  END IF;
END $$;


-- ============================================================================
-- PART 2: COMPOSITE INDEXES
-- ============================================================================
-- Indexes on frequently-joined columns to speed up common query patterns.
-- All use IF NOT EXISTS for idempotency.
-- ============================================================================

-- Connection requests: lookup by buyer + listing (most common join)
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_listing
  ON public.connection_requests(user_id, listing_id);

-- Connection requests: filter by listing + status (admin pipeline queries)
CREATE INDEX IF NOT EXISTS idx_connection_requests_listing_status
  ON public.connection_requests(listing_id, status);

-- Saved listings: user + listing lookup (unique pair check, favorites page)
CREATE INDEX IF NOT EXISTS idx_saved_listings_user_listing
  ON public.saved_listings(user_id, listing_id);

-- Deals: lookup by listing + pipeline stage (deal pipeline views)
CREATE INDEX IF NOT EXISTS idx_deals_listing_stage
  ON public.deals(listing_id, stage_id);

-- Deals: lookup by remarketing buyer + listing (buyer deal history)
CREATE INDEX IF NOT EXISTS idx_deals_remarketing_buyer_listing
  ON public.deals(remarketing_buyer_id, listing_id);

-- Remarketing scores: buyer + listing score lookup (the most queried pair)
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_buyer_listing
  ON public.remarketing_scores(buyer_id, listing_id);

-- Data room access: deal + remarketing buyer (access matrix lookups)
CREATE INDEX IF NOT EXISTS idx_data_room_access_deal_rmkt_buyer
  ON public.data_room_access(deal_id, remarketing_buyer_id);

-- Data room access: deal + marketplace user (marketplace access lookups)
CREATE INDEX IF NOT EXISTS idx_data_room_access_deal_mkt_user
  ON public.data_room_access(deal_id, marketplace_user_id);

-- Buyer deal scores: buyer + deal pair (scoring engine lookups)
CREATE INDEX IF NOT EXISTS idx_buyer_deal_scores_buyer_deal
  ON public.buyer_deal_scores(buyer_id, deal_id);

-- Listing analytics: listing + user (per-user analytics aggregation)
CREATE INDEX IF NOT EXISTS idx_listing_analytics_listing_user
  ON public.listing_analytics(listing_id, user_id);

-- Data room audit log: deal + user (audit trail queries)
CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_deal_user
  ON public.data_room_audit_log(deal_id, user_id);

-- Alert delivery logs: alert + user (delivery tracking)
CREATE INDEX IF NOT EXISTS idx_alert_delivery_logs_alert_user
  ON public.alert_delivery_logs(alert_id, user_id);

-- Score snapshots: buyer + listing (score history queries)
CREATE INDEX IF NOT EXISTS idx_score_snapshots_buyer_listing
  ON public.score_snapshots(buyer_id, listing_id);

-- Document release log: deal + buyer (release history per buyer)
CREATE INDEX IF NOT EXISTS idx_document_release_log_deal_buyer
  ON public.document_release_log(deal_id, buyer_id);


-- ============================================================================
-- PART 3: GIN INDEXES FOR JSONB SEARCH
-- ============================================================================
-- GIN indexes on JSONB columns that are queried with containment operators
-- (@>, ?, ?|, ?&) or need to support flexible key-value lookups.
-- ============================================================================

-- listings: custom_sections — queried for section-based rendering
CREATE INDEX IF NOT EXISTS idx_listings_custom_sections_gin
  ON public.listings USING gin(custom_sections);

-- listings: extraction_sources — queried to check data provenance
CREATE INDEX IF NOT EXISTS idx_listings_extraction_sources_gin
  ON public.listings USING gin(extraction_sources);

-- listings: key_risks — queried for risk-based filtering
CREATE INDEX IF NOT EXISTS idx_listings_key_risks_gin
  ON public.listings USING gin(key_risks);

-- listings: market_position — queried for competitive analysis
CREATE INDEX IF NOT EXISTS idx_listings_market_position_gin
  ON public.listings USING gin(market_position);

-- profiles: business_categories — queried for buyer matching
CREATE INDEX IF NOT EXISTS idx_profiles_business_categories_gin
  ON public.profiles USING gin(business_categories);

-- profiles: target_locations — queried for geographic matching
CREATE INDEX IF NOT EXISTS idx_profiles_target_locations_gin
  ON public.profiles USING gin(target_locations);

-- profiles: geographic_focus — queried for geographic matching
CREATE INDEX IF NOT EXISTS idx_profiles_geographic_focus_gin
  ON public.profiles USING gin(geographic_focus);

-- audit_logs: metadata — queried for audit trail searches
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
  ON public.audit_logs USING gin(metadata);

-- data_room_audit_log: metadata — queried for document access auditing
CREATE INDEX IF NOT EXISTS idx_data_room_audit_log_metadata_gin
  ON public.data_room_audit_log USING gin(metadata);

-- lead_memos: content — queried for memo content searching
CREATE INDEX IF NOT EXISTS idx_lead_memos_content_gin
  ON public.lead_memos USING gin(content);

-- remarketing_buyers: extraction_sources — queried for data provenance
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_extraction_sources_gin
  ON public.remarketing_buyers USING gin(extraction_sources);

-- remarketing_buyers: portfolio_companies — queried for portfolio overlap checks
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_portfolio_companies_gin
  ON public.remarketing_buyers USING gin(portfolio_companies);


-- ============================================================================
-- Summary:
--   44 CHECK constraints added across 10 tables:
--     listings (16), deals (4), remarketing_scores (8),
--     remarketing_buyers (6), daily_metrics (2), engagement_scores (2),
--     profiles (2), valuation_leads (6), connection_requests (1),
--     enrichment_cost_log (3)
--
--   15 composite indexes on frequently-joined FK pairs:
--     connection_requests, saved_listings, deals, remarketing_scores,
--     data_room_access, buyer_deal_scores, listing_analytics,
--     data_room_audit_log, alert_delivery_logs, score_snapshots,
--     document_release_log
--
--   12 GIN indexes on JSONB columns:
--     listings (4), profiles (3), audit_logs (1),
--     data_room_audit_log (1), lead_memos (1), remarketing_buyers (2)
-- ============================================================================
