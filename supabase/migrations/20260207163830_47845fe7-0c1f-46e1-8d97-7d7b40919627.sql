
-- ============================================================================
-- FIX 1: Deduplicate buyer pairs (keep highest data_completeness)
-- ============================================================================

DELETE FROM remarketing_buyers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY LOWER(company_name), universe_id
        ORDER BY 
          CASE data_completeness 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
            ELSE 4 
          END,
          updated_at DESC NULLS LAST,
          created_at DESC
      ) as rn
    FROM remarketing_buyers
    WHERE universe_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ============================================================================
-- FIX 2: Archive orphaned buyers (no universe_id)
-- ============================================================================

UPDATE remarketing_buyers
SET archived = true
WHERE universe_id IS NULL
AND (archived IS NULL OR archived = false);

-- ============================================================================
-- FIX 3: Add extraction_status column to deal_transcripts
-- ============================================================================

ALTER TABLE deal_transcripts
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';

UPDATE deal_transcripts
SET extraction_status = 'completed'
WHERE extracted_data IS NOT NULL AND processed_at IS NOT NULL;

-- ============================================================================
-- FIX 4: Convert SECURITY DEFINER views to SECURITY INVOKER
-- ============================================================================

DROP VIEW IF EXISTS ranked_deals;
DROP VIEW IF EXISTS listings_needing_enrichment;
DROP VIEW IF EXISTS unmapped_primary_owners;

CREATE VIEW listings_needing_enrichment
WITH (security_invoker = true) AS
SELECT l.id, l.title, l.internal_company_name, l.website,
    l.internal_deal_memo_link, l.enriched_at, l.enrichment_scheduled_at, l.created_at,
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

CREATE VIEW unmapped_primary_owners
WITH (security_invoker = true) AS
SELECT l.id, l.title, l.internal_primary_owner, l.primary_owner_id, l.created_at
FROM listings l
WHERE l.deleted_at IS NULL
  AND l.internal_primary_owner IS NOT NULL
  AND l.primary_owner_id IS NULL;

CREATE VIEW ranked_deals
WITH (security_invoker = true) AS
SELECT l.*,
    COALESCE(l.manual_rank_override, l.calculated_rank) AS display_rank,
    COALESCE(l.final_rank, l.calculated_rank) AS effective_rank
FROM listings l
WHERE l.deleted_at IS NULL AND l.status = 'active';

-- ============================================================================
-- FIX 5: Set search_path on functions with mutable search_path
-- ============================================================================

ALTER FUNCTION public.cleanup_zombie_extractions() SET search_path = public;
ALTER FUNCTION public.delete_user_completely(target_user_id uuid) SET search_path = public;
ALTER FUNCTION public.generate_deal_identifier() SET search_path = public;
ALTER FUNCTION public.log_internal_deal_changes() SET search_path = public;
ALTER FUNCTION public.normalize_state_name(text) SET search_path = public;
ALTER FUNCTION public.soft_delete_listing(listing_id uuid) SET search_path = public;
ALTER FUNCTION public.soft_delete_profile(profile_id uuid) SET search_path = public;
ALTER FUNCTION public.sync_user_verification_status() SET search_path = public;
ALTER FUNCTION public.update_buyer_criteria_extractions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_final_rank() SET search_path = public;
ALTER FUNCTION public.update_remarketing_outreach_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_marketplace_publishing() SET search_path = public;
ALTER FUNCTION public.validate_reset_token(token_value text) SET search_path = public;
