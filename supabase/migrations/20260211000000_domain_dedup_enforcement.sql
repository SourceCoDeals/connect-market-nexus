-- =============================================================================
-- Domain-Based Dedup Enforcement
-- Ensures no two buyers with the same domain exist per universe,
-- and no two deals with the same domain exist globally.
-- =============================================================================

-- Step 1: Create a reusable domain normalization function (IMMUTABLE for index use)
CREATE OR REPLACE FUNCTION normalize_domain(url text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN url IS NULL OR trim(url) = '' OR trim(url) = '<UNKNOWN>' THEN NULL
    ELSE
      split_part(          -- strip port
        split_part(        -- strip path
          regexp_replace(
            regexp_replace(
              lower(trim(url)),
              '^https?://', ''    -- strip protocol
            ),
            '^www\.', ''          -- strip www.
          ),
          '/', 1
        ),
        ':', 1
      )
  END
$$;

-- Step 2: Normalize existing company_website values in remarketing_buyers
-- This ensures the unique index can properly detect duplicates
UPDATE remarketing_buyers
SET company_website = normalize_domain(company_website)
WHERE company_website IS NOT NULL
  AND company_website != ''
  AND normalize_domain(company_website) IS NOT NULL
  AND normalize_domain(company_website) != company_website;

-- Also normalize platform_website for consistency
UPDATE remarketing_buyers
SET platform_website = normalize_domain(platform_website)
WHERE platform_website IS NOT NULL
  AND platform_website != ''
  AND normalize_domain(platform_website) IS NOT NULL
  AND normalize_domain(platform_website) != platform_website;

-- Step 3: Archive duplicate buyers per universe (keep the best record)
-- Uses COALESCE for universe_id so that NULL universe buyers are also deduped
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(universe_id, '00000000-0000-0000-0000-000000000000'::uuid),
        normalize_domain(company_website)
      ORDER BY
        CASE WHEN thesis_summary IS NOT NULL AND thesis_summary != '' THEN 0 ELSE 1 END,
        CASE WHEN data_completeness = 'high' THEN 0 WHEN data_completeness = 'medium' THEN 1 ELSE 2 END,
        created_at ASC
    ) as rn
  FROM remarketing_buyers
  WHERE archived = false
    AND company_website IS NOT NULL
    AND company_website != ''
    AND normalize_domain(company_website) IS NOT NULL
)
UPDATE remarketing_buyers SET archived = true
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 4: Drop and recreate buyer unique index with proper normalization
-- Old index only used lower() which didn't strip protocol/www
DROP INDEX IF EXISTS idx_remarketing_buyers_unique_website_per_universe;

CREATE UNIQUE INDEX idx_remarketing_buyers_unique_website_per_universe
ON public.remarketing_buyers (
  COALESCE(universe_id, '00000000-0000-0000-0000-000000000000'::uuid),
  normalize_domain(company_website)
)
WHERE archived = false
  AND company_website IS NOT NULL
  AND company_website != ''
  AND normalize_domain(company_website) IS NOT NULL;

-- Step 5: Handle any duplicate listings that the old index missed (www variants)
DO $$
DECLARE
  dup_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO dup_ids
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY normalize_domain(website)
             ORDER BY
               CASE WHEN enriched_at IS NOT NULL THEN 0 ELSE 1 END,
               CASE WHEN revenue IS NOT NULL AND revenue > 0 THEN 0 ELSE 1 END,
               created_at ASC
           ) as rn
    FROM listings
    WHERE website IS NOT NULL AND website != '' AND website != '<UNKNOWN>'
      AND normalize_domain(website) IS NOT NULL
  ) sub
  WHERE rn > 1;

  IF dup_ids IS NOT NULL AND array_length(dup_ids, 1) > 0 THEN
    RAISE NOTICE 'Deleting % duplicate listings found by improved normalization', array_length(dup_ids, 1);

    -- Delete ALL FK references before removing duplicates
    DELETE FROM alert_delivery_logs WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_approve_decisions WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_learning_history WHERE listing_id = ANY(dup_ids);
    DELETE FROM buyer_pass_decisions WHERE listing_id = ANY(dup_ids);
    DELETE FROM chat_conversations WHERE listing_id = ANY(dup_ids);
    DELETE FROM collection_items WHERE listing_id = ANY(dup_ids);
    DELETE FROM connection_requests WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_ranking_history WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_referrals WHERE listing_id = ANY(dup_ids);
    DELETE FROM deals WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_scoring_adjustments WHERE listing_id = ANY(dup_ids);
    DELETE FROM deal_transcripts WHERE listing_id = ANY(dup_ids);
    DELETE FROM enrichment_queue WHERE listing_id = ANY(dup_ids);
    UPDATE inbound_leads SET mapped_to_listing_id = NULL WHERE mapped_to_listing_id = ANY(dup_ids);
    DELETE FROM listing_analytics WHERE listing_id = ANY(dup_ids);
    DELETE FROM listing_conversations WHERE listing_id = ANY(dup_ids);
    DELETE FROM outreach_records WHERE listing_id = ANY(dup_ids);
    DELETE FROM owner_intro_notifications WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_outreach WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_scores WHERE listing_id = ANY(dup_ids);
    DELETE FROM remarketing_universe_deals WHERE listing_id = ANY(dup_ids);
    DELETE FROM saved_listings WHERE listing_id = ANY(dup_ids);
    DELETE FROM similar_deal_alerts WHERE source_listing_id = ANY(dup_ids);
    DELETE FROM buyer_deal_scores WHERE deal_id::uuid = ANY(dup_ids);

    DELETE FROM listings WHERE id = ANY(dup_ids);
  END IF;
END $$;

-- Step 6: Drop and recreate listings unique index with www stripping
DROP INDEX IF EXISTS idx_listings_unique_website;

CREATE UNIQUE INDEX idx_listings_unique_website
ON listings (normalize_domain(website))
WHERE website IS NOT NULL
  AND website != ''
  AND website != '<UNKNOWN>'
  AND normalize_domain(website) IS NOT NULL;
