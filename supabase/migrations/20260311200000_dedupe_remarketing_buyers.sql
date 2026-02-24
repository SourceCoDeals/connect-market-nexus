-- ============================================================================
-- Deduplicate remarketing_buyers
-- ============================================================================
-- Audit found 100+ duplicate buyer records (Summit Partners x9, MidOcean x7,
-- Gauge Capital x6, etc.) caused by repeated imports without dedup checks.
--
-- Strategy:
--   1. Normalize company names (lowercase, strip punctuation + legal suffixes)
--   2. Within each duplicate group, elect a KEEPER — the record with the most
--      non-null fields, breaking ties by oldest created_at
--   3. Re-point remarketing_scores and remarketing_buyer_contacts to the keeper
--   4. Merge unique notes/thesis data into the keeper
--   5. Archive (archived = true) all non-keeper duplicates
--
-- Safe to run multiple times (idempotent via archived = false filter).
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- Step 1: Build normalized name groups
-- -----------------------------------------------------------------------
CREATE TEMP TABLE _buyer_normalized AS
SELECT
  id,
  company_name,
  company_website,
  notes,
  thesis_summary,
  target_geographies,
  target_services,
  target_industries,
  data_completeness,
  data_last_updated,
  created_at,
  archived,
  -- Normalize: lowercase, strip non-alphanumeric, remove common legal suffixes
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      LOWER(TRIM(company_name)),
      '\s*(llc|inc|corp|ltd|co|group|partners|capital|investments|holdings|management|equity|ventures|ventures)\s*\.?$',
      '',
      'g'
    ),
    '[^a-z0-9]',
    '',
    'g'
  ) AS normalized_name
FROM public.remarketing_buyers
WHERE archived = false
  AND company_name IS NOT NULL
  AND TRIM(company_name) <> '';

-- -----------------------------------------------------------------------
-- Step 2: Find groups with 2+ members (actual duplicates)
-- -----------------------------------------------------------------------
CREATE TEMP TABLE _dup_groups AS
SELECT
  normalized_name,
  COUNT(*) AS member_count,
  -- Score each member by data completeness (more non-null fields = better)
  -- We'll pick the keeper per group in Step 3
  ARRAY_AGG(id ORDER BY
    -- Prefer records with more populated fields
    (CASE WHEN thesis_summary IS NOT NULL THEN 2 ELSE 0 END +
     CASE WHEN data_completeness = 'high' THEN 3 WHEN data_completeness = 'medium' THEN 2 ELSE 0 END +
     CASE WHEN data_last_updated IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN ARRAY_LENGTH(target_geographies, 1) > 0 THEN 1 ELSE 0 END +
     CASE WHEN ARRAY_LENGTH(target_industries, 1) > 0 THEN 1 ELSE 0 END
    ) DESC,
    created_at ASC  -- oldest wins tiebreaker
  ) AS member_ids
FROM _buyer_normalized
WHERE normalized_name <> ''
GROUP BY normalized_name
HAVING COUNT(*) >= 2;

-- -----------------------------------------------------------------------
-- Step 3: Elect keepers and collect duplicates
-- -----------------------------------------------------------------------
CREATE TEMP TABLE _keeper_map AS
SELECT
  normalized_name,
  member_ids[1]                          AS keeper_id,
  member_ids[2:ARRAY_LENGTH(member_ids, 1)] AS duplicate_ids,
  member_count
FROM _dup_groups;

-- Flatten duplicate IDs for easy joining
CREATE TEMP TABLE _duplicates AS
SELECT
  km.keeper_id,
  km.normalized_name,
  UNNEST(km.duplicate_ids) AS duplicate_id
FROM _keeper_map km;

-- -----------------------------------------------------------------------
-- Step 4a: Re-point remarketing_scores to keeper
-- -----------------------------------------------------------------------
UPDATE public.remarketing_scores rs
SET buyer_id = d.keeper_id
FROM _duplicates d
WHERE rs.buyer_id = d.duplicate_id
  -- Avoid creating a duplicate (keeper, listing) pair — skip if already scored
  AND NOT EXISTS (
    SELECT 1 FROM public.remarketing_scores existing
    WHERE existing.buyer_id  = d.keeper_id
      AND existing.listing_id = rs.listing_id
  );

-- Delete scores for duplicates that already have a keeper score for the same listing
DELETE FROM public.remarketing_scores rs
USING _duplicates d
WHERE rs.buyer_id = d.duplicate_id;

-- -----------------------------------------------------------------------
-- Step 4b: Re-point remarketing_buyer_contacts to keeper
-- -----------------------------------------------------------------------
UPDATE public.remarketing_buyer_contacts rbc
SET buyer_id = d.keeper_id
FROM _duplicates d
WHERE rbc.buyer_id = d.duplicate_id;

-- -----------------------------------------------------------------------
-- Step 4c: Re-point remarketing_outreach to keeper
-- -----------------------------------------------------------------------
UPDATE public.remarketing_outreach ro
SET buyer_id = d.keeper_id
FROM _duplicates d
WHERE ro.buyer_id = d.duplicate_id;

-- -----------------------------------------------------------------------
-- Step 5: Merge notes into keeper (append duplicate's notes if different)
-- -----------------------------------------------------------------------
UPDATE public.remarketing_buyers keeper
SET
  notes = CASE
    WHEN keeper.notes IS NULL THEN dup.notes
    WHEN dup.notes IS NULL OR dup.notes = keeper.notes THEN keeper.notes
    ELSE keeper.notes || E'\n---\n' || dup.notes
  END,
  -- Promote thesis if keeper has none
  thesis_summary = COALESCE(keeper.thesis_summary, dup.thesis_summary),
  -- Merge target arrays (union)
  target_geographies = ARRAY(
    SELECT DISTINCT UNNEST(keeper.target_geographies || dup.target_geographies)
  ),
  target_industries = ARRAY(
    SELECT DISTINCT UNNEST(keeper.target_industries || dup.target_industries)
  ),
  target_services = ARRAY(
    SELECT DISTINCT UNNEST(keeper.target_services || dup.target_services)
  ),
  -- Use the better data_completeness score
  data_completeness = CASE
    WHEN keeper.data_completeness = 'high' OR dup.data_completeness = 'high' THEN 'high'
    WHEN keeper.data_completeness = 'medium' OR dup.data_completeness = 'medium' THEN 'medium'
    ELSE 'low'
  END,
  updated_at = NOW()
FROM public.remarketing_buyers dup
JOIN _duplicates d ON dup.id = d.duplicate_id
WHERE keeper.id = d.keeper_id;

-- -----------------------------------------------------------------------
-- Step 6: Archive all duplicate (non-keeper) records
-- -----------------------------------------------------------------------
UPDATE public.remarketing_buyers
SET
  archived = true,
  notes = COALESCE(notes, '') ||
    E'\n[ARCHIVED: duplicate of ' || keeper_id::text || ' by dedup migration 20260311]',
  updated_at = NOW()
FROM _duplicates
WHERE remarketing_buyers.id = _duplicates.duplicate_id;

-- -----------------------------------------------------------------------
-- Step 7: Report
-- -----------------------------------------------------------------------
DO $$
DECLARE
  v_groups     INT;
  v_archived   INT;
  v_kept       INT;
BEGIN
  SELECT COUNT(*) INTO v_groups  FROM _keeper_map;
  SELECT COUNT(*) INTO v_archived FROM _duplicates;
  v_kept := v_groups;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Buyer Deduplication Complete';
  RAISE NOTICE '  Duplicate groups found:  %', v_groups;
  RAISE NOTICE '  Records kept (keepers):  %', v_kept;
  RAISE NOTICE '  Records archived:        %', v_archived;
  RAISE NOTICE '========================================';
END;
$$;

-- Clean up temp tables
DROP TABLE IF EXISTS _buyer_normalized;
DROP TABLE IF EXISTS _dup_groups;
DROP TABLE IF EXISTS _keeper_map;
DROP TABLE IF EXISTS _duplicates;

COMMIT;

-- ============================================================================
-- Verification query — run after migration to confirm results
-- ============================================================================
-- SELECT
--   normalized,
--   COUNT(*) AS remaining_active
-- FROM (
--   SELECT
--     REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(company_name)),
--       '\s*(llc|inc|corp|ltd|co|group|partners|capital|investments|holdings|management|equity|ventures)\s*\.?$',
--       '', 'g'), '[^a-z0-9]', '', 'g') AS normalized
--   FROM public.remarketing_buyers
--   WHERE archived = false
-- ) t
-- GROUP BY normalized
-- HAVING COUNT(*) > 1
-- ORDER BY remaining_active DESC;
-- (Should return 0 rows if dedup was successful)
-- ============================================================================
