-- ============================================================
-- Fix auto_shop duplicate test entries and encoding issues
-- ============================================================

-- ─── 1. Fix mojibake apostrophe in "Dino's Auto Care" ───
-- The raw data has â€™ (UTF-8 mojibake) instead of a proper apostrophe
UPDATE valuation_leads
SET website = REPLACE(website, 'â€™', '''')
WHERE website LIKE '%â€™%';

UPDATE valuation_leads
SET business_name = REPLACE(business_name, 'â€™', '''')
WHERE business_name LIKE '%â€™%';

-- ─── 2. Re-exclude known SourceCoDeals test accounts for auto_shop ───
-- These were originally excluded='test' but migration 220000 un-excluded all auto_shop.
UPDATE valuation_leads
SET excluded = true,
    exclusion_reason = 'test'
WHERE calculator_type = 'auto_shop'
  AND (
    LOWER(email) IN ('ahaile14@gmail.com', 'adambhaile00@gmail.com', 'bill.martin@sourcecodeals.com')
    OR website = 'sourcecodeals.com'
  );

-- ─── 3. Deduplicate remaining auto_shop entries (keep most recent per email) ───
WITH ranked AS (
  SELECT
    id,
    email,
    calculator_type,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(email), calculator_type
      ORDER BY created_at DESC
    ) AS rn
  FROM valuation_leads
  WHERE calculator_type = 'auto_shop'
    AND email IS NOT NULL
    AND excluded = false
)
UPDATE valuation_leads vl
SET excluded = true,
    exclusion_reason = 'duplicate'
FROM ranked r
WHERE vl.id = r.id
  AND r.rn > 1;

-- ─── 4. Clear bad single-word business_name values from INITCAP extraction ───
-- These are concatenated domain names that INITCAP couldn't properly format
-- (e.g. "Usaquaticsinc", "Thevalensclinic") — clear them so the smarter
-- client-side segmentation takes over.
UPDATE valuation_leads
SET business_name = NULL
WHERE business_name IS NOT NULL
  AND business_name !~ '\s'             -- single word (no spaces)
  AND business_name !~ '''s Business$'  -- not a placeholder
  AND LENGTH(business_name) > 10;       -- likely a concatenated domain name

-- ============================================================
-- Summary:
--   1. Fixed â€™ mojibake in website/business_name fields
--   2. Re-excluded SourceCoDeals test accounts for auto_shop
--   3. Deduplicated remaining auto_shop entries (kept most recent per email)
--   4. Cleared bad concatenated single-word business names for client-side segmentation
-- ============================================================
