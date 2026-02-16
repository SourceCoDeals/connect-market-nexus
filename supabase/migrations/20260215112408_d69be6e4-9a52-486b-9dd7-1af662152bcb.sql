-- Fix security definer on ranked_deals view
DROP VIEW IF EXISTS public.ranked_deals;
CREATE VIEW public.ranked_deals WITH (security_invoker=on) AS
SELECT 
  l.id, l.title, l.internal_company_name, l.category, l.location,
  l.revenue, l.ebitda, l.status, l.created_at, l.deal_total_score,
  l.deal_size_score, l.enriched_at, l.linkedin_employee_count,
  l.linkedin_employee_range, l.google_review_count, l.google_rating,
  l.is_priority_target, l.website, l.deal_source, l.address_city,
  l.address_state, l.full_time_employees, l.executive_summary, l.description
FROM public.listings l
WHERE l.deleted_at IS NULL AND l.status = 'active'
ORDER BY l.deal_total_score DESC NULLS LAST;