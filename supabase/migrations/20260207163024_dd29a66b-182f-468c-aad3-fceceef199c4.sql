
-- ============================================================================
-- FIX 1: Add unique constraint on remarketing_buyer_contacts (buyer_id, name)
-- First remove duplicates, keeping the one with most data
-- ============================================================================

-- Delete duplicate contacts keeping the earliest (most complete) one
DELETE FROM remarketing_buyer_contacts a
USING remarketing_buyer_contacts b
WHERE a.buyer_id = b.buyer_id 
  AND lower(trim(a.name)) = lower(trim(b.name))
  AND a.created_at > b.created_at;

-- Add unique constraint to prevent future duplicates
ALTER TABLE remarketing_buyer_contacts 
  ADD CONSTRAINT remarketing_buyer_contacts_buyer_name_unique 
  UNIQUE (buyer_id, name);

-- ============================================================================
-- FIX 2: Deduplicate buyers by company_name within same universe
-- Keep the one with best data_completeness or most recent update
-- ============================================================================

-- Mark duplicate buyers as archived (keep the one with best data)
WITH ranked_dupes AS (
  SELECT id, company_name, universe_id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(company_name)), universe_id 
      ORDER BY 
        CASE data_completeness WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        data_last_updated DESC NULLS LAST,
        created_at ASC
    ) as rn
  FROM remarketing_buyers
  WHERE universe_id IS NOT NULL
)
UPDATE remarketing_buyers SET archived = true
WHERE id IN (SELECT id FROM ranked_dupes WHERE rn > 1);

-- ============================================================================
-- FIX 3: Fix 56 orphaned buyers (no universe_id) — archive them
-- ============================================================================

UPDATE remarketing_buyers 
SET archived = true 
WHERE universe_id IS NULL AND archived = false;

-- ============================================================================
-- FIX 4: Reconcile enrichment metadata mismatches
-- Set data_last_updated for buyers that have data_completeness but no timestamp
-- ============================================================================

UPDATE remarketing_buyers 
SET data_last_updated = COALESCE(updated_at, created_at)
WHERE data_completeness IS NOT NULL 
  AND data_last_updated IS NULL;
