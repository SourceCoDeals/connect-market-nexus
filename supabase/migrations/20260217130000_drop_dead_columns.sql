-- Phase 1: Drop confirmed dead columns from listings table
-- These columns have ZERO code references outside types.ts and migrations.
-- Verified via grep across src/ and supabase/functions/ on 2026-02-17.

-- 1. Drop trigger + function that depend on calculated_rank
DROP TRIGGER IF EXISTS trigger_update_final_rank ON public.listings;
DROP FUNCTION IF EXISTS public.update_final_rank();

-- 2. Recreate listings_needing_enrichment view WITHOUT enrichment_scheduled_at
DROP VIEW IF EXISTS listings_needing_enrichment;

CREATE VIEW listings_needing_enrichment
WITH (security_invoker = true) AS
SELECT l.id, l.title, l.internal_company_name, l.website,
    l.internal_deal_memo_link, l.enriched_at, l.created_at,
    eq.status AS queue_status, eq.attempts, eq.last_error, eq.queued_at
FROM listings l
LEFT JOIN enrichment_queue eq ON l.id = eq.listing_id
WHERE l.deleted_at IS NULL
  AND (l.website IS NOT NULL
    OR (l.internal_deal_memo_link IS NOT NULL
      AND l.internal_deal_memo_link NOT LIKE '%sharepoint%'
      AND l.internal_deal_memo_link NOT LIKE '%onedrive%'))
  AND (l.enriched_at IS NULL OR l.enriched_at < (now() - '30 days'::interval))
ORDER BY l.created_at DESC;

-- 3. Now drop the dead columns
ALTER TABLE public.listings
  DROP COLUMN IF EXISTS ai_description,
  DROP COLUMN IF EXISTS estimated_ebitda,
  DROP COLUMN IF EXISTS lead_source_notes,
  DROP COLUMN IF EXISTS is_owner_dependent,
  DROP COLUMN IF EXISTS has_multiple_locations,
  DROP COLUMN IF EXISTS product_revenue_percentage,
  DROP COLUMN IF EXISTS service_revenue_percentage,
  DROP COLUMN IF EXISTS recurring_revenue_percentage,
  DROP COLUMN IF EXISTS project_revenue_percentage,
  DROP COLUMN IF EXISTS calculated_rank,
  DROP COLUMN IF EXISTS final_rank,
  DROP COLUMN IF EXISTS rank_locked,
  DROP COLUMN IF EXISTS last_ranked_at,
  DROP COLUMN IF EXISTS enrichment_scheduled_at,
  DROP COLUMN IF EXISTS enrichment_last_attempted_at,
  DROP COLUMN IF EXISTS enrichment_refresh_due_at,
  DROP COLUMN IF EXISTS enrichment_last_successful_at,
  DROP COLUMN IF EXISTS enrichment_error_message,
  DROP COLUMN IF EXISTS deal_industry_score,
  DROP COLUMN IF EXISTS deal_motivation_score;
