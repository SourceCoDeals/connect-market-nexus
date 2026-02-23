-- ============================================================================
-- Create marketplace_listings view (defense-in-depth)
-- ============================================================================
-- Exposes only marketplace-safe columns and enforces is_internal_deal = false.
-- Marketplace queries can use this view instead of the raw listings table
-- to prevent accidental exposure of internal fields.
-- (Audit Section 4, Recommendation 3)
-- ============================================================================

CREATE OR REPLACE VIEW public.marketplace_listings AS
SELECT
  id,
  title,
  description,
  description_html,
  description_json,
  hero_description,
  category,
  categories,
  location,
  revenue,
  ebitda,
  image_url,
  status,
  status_tag,
  tags,
  created_at,
  updated_at,
  published_at,
  is_internal_deal,
  deleted_at,
  visible_to_buyer_types,
  acquisition_type,
  full_time_employees,
  part_time_employees,
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
  ebitda_metric_subtitle
FROM public.listings
WHERE status = 'active'
  AND deleted_at IS NULL
  AND is_internal_deal = false;

-- The view inherits RLS from the underlying table, but also enforces
-- is_internal_deal = false at the view level for defense-in-depth.
COMMENT ON VIEW public.marketplace_listings IS
'Safe marketplace view: exposes only display-safe columns from listings, excluding internal fields (internal_company_name, website, main_contact_*, internal_notes, address_*). Enforces is_internal_deal = false.';
