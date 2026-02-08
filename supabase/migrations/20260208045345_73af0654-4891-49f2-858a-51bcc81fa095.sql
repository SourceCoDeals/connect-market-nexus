
-- LinkedIn Match Confidence columns on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS linkedin_match_confidence text,
  ADD COLUMN IF NOT EXISTS linkedin_match_signals jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_verified_at timestamptz;

-- Quality Scoring V2 columns on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS revenue_score numeric,
  ADD COLUMN IF NOT EXISTS ebitda_score numeric,
  ADD COLUMN IF NOT EXISTS linkedin_boost numeric,
  ADD COLUMN IF NOT EXISTS quality_calculation_version text;

-- LinkedIn manual review queue view
CREATE OR REPLACE VIEW public.linkedin_manual_review_queue AS
SELECT
  l.id,
  l.title,
  l.address_city,
  l.address_state,
  l.linkedin_url,
  l.linkedin_match_confidence,
  l.linkedin_match_signals,
  l.linkedin_verified_at,
  l.linkedin_employee_count,
  l.linkedin_employee_range
FROM public.listings l
WHERE l.deleted_at IS NULL
  AND l.status = 'active'
  AND (
    l.linkedin_match_confidence = 'low'
    OR (l.linkedin_match_confidence IS NULL AND l.linkedin_url IS NOT NULL)
    OR (l.linkedin_match_signals->>'websiteMatch')::boolean = false
  )
ORDER BY l.created_at DESC;

-- Deal quality analysis view
CREATE OR REPLACE VIEW public.deal_quality_analysis AS
SELECT
  l.id,
  l.title,
  l.address_city,
  l.address_state,
  l.revenue,
  l.ebitda,
  l.deal_total_score,
  l.deal_size_score,
  l.revenue_score,
  l.ebitda_score,
  l.linkedin_boost,
  l.quality_calculation_version,
  l.linkedin_employee_count,
  l.google_review_count,
  l.google_rating,
  l.seller_interest_score,
  l.linkedin_match_confidence,
  CASE
    WHEN l.deal_total_score >= 80 THEN 'A'
    WHEN l.deal_total_score >= 60 THEN 'B'
    WHEN l.deal_total_score >= 40 THEN 'C'
    ELSE 'D'
  END AS quality_tier
FROM public.listings l
WHERE l.deleted_at IS NULL
  AND l.status = 'active'
ORDER BY l.deal_total_score DESC NULLS LAST;
