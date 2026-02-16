-- First, copy any deal_quality_score values to deal_total_score (only if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'deal_quality_score'
  ) THEN
    UPDATE public.listings
    SET deal_total_score = deal_quality_score
    WHERE deal_total_score IS NULL AND deal_quality_score IS NOT NULL;
  END IF;
END $$;

-- Drop the view that depends on the column first
DROP VIEW IF EXISTS public.ranked_deals;

-- Also check deal_quality_analysis view
DROP VIEW IF EXISTS public.deal_quality_analysis;

-- Now drop the legacy column
ALTER TABLE public.listings DROP COLUMN IF EXISTS deal_quality_score;

-- Recreate ranked_deals view using deal_total_score
CREATE VIEW public.ranked_deals AS
SELECT 
  l.id,
  l.title,
  l.internal_company_name,
  l.category,
  l.location,
  l.revenue,
  l.ebitda,
  l.status,
  l.created_at,
  l.deal_total_score,
  l.deal_size_score,
  l.enriched_at,
  l.linkedin_employee_count,
  l.linkedin_employee_range,
  l.google_review_count,
  l.google_rating,
  l.is_priority_target,
  l.website,
  l.deal_source,
  l.address_city,
  l.address_state,
  l.full_time_employees,
  l.executive_summary,
  l.description
FROM public.listings l
WHERE l.deleted_at IS NULL
  AND l.status = 'active'
ORDER BY l.deal_total_score DESC NULLS LAST;