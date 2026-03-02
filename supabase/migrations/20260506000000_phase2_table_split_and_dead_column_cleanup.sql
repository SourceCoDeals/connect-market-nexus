-- ============================================================================
-- Phase 2: Logical Table Split + Dead Column Cleanup
-- ============================================================================
-- Creates `deals` and `marketplace_listings` as auto-updatable views over
-- the `listings` table, providing clean logical separation between the
-- internal deal pipeline and the public marketplace.
--
-- The `listings` table stays as the physical storage layer because 30+
-- tables have foreign key references to listings(id). The views provide:
--   1. Column-level separation (each view shows only relevant columns)
--   2. Row-level separation (deals vs marketplace via source_deal_id)
--   3. Full CRUD support (auto-updatable views, no triggers needed)
--   4. WITH CHECK OPTION (prevents inserting a deal through the marketplace view)
--
-- Dead/unused columns (identified by comprehensive codebase audit) are
-- dropped from the base table to reduce bloat.
-- ============================================================================

-- ============================================================================
-- 1. Drop dead/unused columns (zero code references outside types.ts)
-- ============================================================================
ALTER TABLE public.listings DROP COLUMN IF EXISTS financial_followup_questions;
ALTER TABLE public.listings DROP COLUMN IF EXISTS seller_interest_analyzed_at;
ALTER TABLE public.listings DROP COLUMN IF EXISTS seller_interest_notes;
ALTER TABLE public.listings DROP COLUMN IF EXISTS linkedin_match_confidence;
ALTER TABLE public.listings DROP COLUMN IF EXISTS linkedin_match_signals;
ALTER TABLE public.listings DROP COLUMN IF EXISTS linkedin_verified_at;
ALTER TABLE public.listings DROP COLUMN IF EXISTS industry_tier_name;
ALTER TABLE public.listings DROP COLUMN IF EXISTS manual_rank_set_at;
ALTER TABLE public.listings DROP COLUMN IF EXISTS notes_analyzed_at;
ALTER TABLE public.listings DROP COLUMN IF EXISTS sf_record_type_id;
ALTER TABLE public.listings DROP COLUMN IF EXISTS sf_previous_search_opportunity_id;

-- captarget_row_hash has a UNIQUE constraint/index — drop index first
DROP INDEX IF EXISTS idx_listings_captarget_row_hash;
ALTER TABLE public.listings DROP COLUMN IF EXISTS captarget_row_hash;

-- fts column (PostgreSQL full-text search vector, never used by app code)
ALTER TABLE public.listings DROP COLUMN IF EXISTS fts;

-- status_label (zero usage, replaced by status_tag)
ALTER TABLE public.listings DROP COLUMN IF EXISTS status_label;

-- ============================================================================
-- 2. Drop the Phase 1 marketplace_listings view (we're replacing it)
-- ============================================================================
DROP VIEW IF EXISTS public.marketplace_listings;

-- ============================================================================
-- 3. Create `deals` view — auto-updatable, full CRUD
-- ============================================================================
-- Deals are rows in `listings` where source_deal_id IS NULL, meaning
-- they are the original entity (not derived from another row).
-- Uses SELECT * so it inherits all columns from the base table.
-- WITH LOCAL CHECK OPTION ensures inserts/updates through this view
-- always satisfy the filter (can't accidentally create a marketplace listing).
-- ============================================================================
CREATE OR REPLACE VIEW public.deals AS
SELECT *
FROM public.listings
WHERE source_deal_id IS NULL
WITH LOCAL CHECK OPTION;

COMMENT ON VIEW public.deals IS
'Auto-updatable view: internal deals. Filtered to rows where source_deal_id IS NULL.
Supports full CRUD via PostgREST. Use this for all deal pipeline operations
(enrichment, scoring, remarketing, contacts, Salesforce sync).
WITH CHECK OPTION prevents accidentally inserting marketplace listings through this view.';

-- ============================================================================
-- 4. Create `marketplace_listings` view — auto-updatable, clean columns
-- ============================================================================
-- Marketplace listings are rows derived from a deal (source_deal_id IS NOT NULL).
-- This view exposes ONLY marketplace-relevant columns, providing a clean
-- interface for buyer-facing pages.
-- Financial data (revenue, ebitda, etc.) is synced from the source deal
-- by the trg_sync_deal_financials trigger from Phase 1.
-- ============================================================================
CREATE OR REPLACE VIEW public.marketplace_listings AS
SELECT
  -- Identity
  id,
  source_deal_id,
  -- Content
  title,
  description,
  description_html,
  description_json,
  hero_description,
  custom_sections,
  -- Financial (synced from source deal by trigger)
  revenue,
  ebitda,
  ebitda_margin,
  full_time_employees,
  part_time_employees,
  -- Location & Classification
  location,
  category,
  categories,
  -- Presentation
  image_url,
  status,
  status_tag,
  tags,
  acquisition_type,
  visible_to_buyer_types,
  -- Custom Metrics (marketplace display)
  custom_metric_label,
  custom_metric_value,
  custom_metric_subtitle,
  metric_3_type,
  metric_3_custom_label,
  metric_3_custom_value,
  metric_3_custom_subtitle,
  metric_4_type,
  metric_4_custom_label,
  metric_4_custom_value,
  metric_4_custom_subtitle,
  revenue_metric_subtitle,
  ebitda_metric_subtitle,
  -- Publishing
  published_at,
  published_by_admin_id,
  pushed_to_marketplace,
  pushed_to_marketplace_at,
  pushed_to_marketplace_by,
  presented_by_admin_id,
  -- Flags
  is_internal_deal,
  deleted_at,
  -- Files
  files,
  -- Timestamps
  created_at,
  updated_at
FROM public.listings
WHERE source_deal_id IS NOT NULL
WITH LOCAL CHECK OPTION;

COMMENT ON VIEW public.marketplace_listings IS
'Auto-updatable view: public marketplace listings. Shows only presentation columns.
Financial data is kept in sync from the source deal via trg_sync_deal_financials trigger.
Supports full CRUD via PostgREST. WITH CHECK OPTION ensures source_deal_id is always set.';

-- ============================================================================
-- 5. Grant permissions on views (inherit from base table)
-- ============================================================================
-- Views inherit RLS from the base table, but we need to grant access
-- to the roles that PostgREST uses.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT SELECT ON public.deals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT SELECT ON public.marketplace_listings TO anon;

-- ============================================================================
-- 6. Create helper function: get deal for a marketplace listing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_deal_for_listing(p_listing_id uuid)
RETURNS SETOF public.deals AS $$
  SELECT d.*
  FROM public.deals d
  JOIN public.listings ml ON ml.source_deal_id = d.id
  WHERE ml.id = p_listing_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.get_deal_for_listing IS
'Returns the source deal for a given marketplace listing ID.
Usage: SELECT * FROM get_deal_for_listing(''listing-uuid'')';

-- ============================================================================
-- 7. Create helper function: get marketplace listings for a deal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_listings_for_deal(p_deal_id uuid)
RETURNS SETOF public.marketplace_listings AS $$
  SELECT ml.*
  FROM public.marketplace_listings ml
  WHERE ml.source_deal_id = p_deal_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.get_listings_for_deal IS
'Returns all marketplace listings created from a given deal.
Usage: SELECT * FROM get_listings_for_deal(''deal-uuid'')';

-- ============================================================================
-- 8. Add index for marketplace listing lookups by source_deal_id
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listings_source_deal_id
ON public.listings(source_deal_id)
WHERE source_deal_id IS NOT NULL;

-- ============================================================================
-- 9. Add partial index for deal rows (improves deals view performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listings_deals_only
ON public.listings(id)
WHERE source_deal_id IS NULL;
