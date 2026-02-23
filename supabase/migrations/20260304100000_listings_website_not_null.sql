-- ============================================================================
-- Make listings.website NOT NULL
-- ============================================================================
-- The website field is the primary deal anchor used for enrichment,
-- deduplication (idx_listings_unique_website), and scoring. NULL websites
-- prevent deals from being enriched or properly deduplicated.
-- (Audit Section 1, Issue 1)
--
-- Strategy:
-- 1. Backfill NULL websites from internal_company_name (slugified)
-- 2. For remaining NULLs, use a placeholder derived from the listing ID
-- 3. Add NOT NULL constraint
-- ============================================================================

-- Step 1: Backfill from internal_company_name where possible
UPDATE public.listings
SET website = LOWER(REGEXP_REPLACE(internal_company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '.unknown'
WHERE website IS NULL
  AND internal_company_name IS NOT NULL
  AND TRIM(internal_company_name) != '';

-- Step 2: Backfill remaining NULLs with ID-based placeholder
UPDATE public.listings
SET website = 'unknown-' || id::text || '.placeholder'
WHERE website IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE public.listings ALTER COLUMN website SET NOT NULL;

-- Step 4: Add CHECK constraint to prevent empty strings
ALTER TABLE public.listings ADD CONSTRAINT chk_listings_website_not_empty
  CHECK (TRIM(website) != '');
