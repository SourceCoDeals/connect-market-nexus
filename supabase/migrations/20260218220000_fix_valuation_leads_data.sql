-- ============================================================
-- Fix valuation_leads data:
-- 1) Un-exclude Auto Shop leads (they're real, not test)
-- 2) Deduplicate: keep most recent per email+calculator_type
-- 3) Extract business names from email domains / websites
-- 4) Add trigger to auto-mark future duplicates on insert
-- ============================================================

-- ─── 1. Un-exclude Auto Shop leads ───
UPDATE valuation_leads
SET excluded = false, exclusion_reason = NULL
WHERE calculator_type = 'auto_shop' AND excluded = true;

-- ─── 2. Deduplicate: keep most recent per email+calculator_type, exclude rest ───
-- First, mark all older duplicates as excluded
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
  WHERE email IS NOT NULL
    AND excluded = false
)
UPDATE valuation_leads vl
SET excluded = true,
    exclusion_reason = 'duplicate'
FROM ranked r
WHERE vl.id = r.id
  AND r.rn > 1;

-- ─── 3. Extract business names from email domains / websites ───
-- Only update rows where business_name is NULL or follows the "<user>'s Business" pattern
UPDATE valuation_leads
SET business_name = derived.new_name
FROM (
  SELECT
    id,
    CASE
      -- Priority 1: Extract from website domain
      WHEN website IS NOT NULL
        AND website != ''
        AND website !~ '^(test|www\.test|no)\.'
        AND website NOT IN ('no.com', 'test.com', 'www.test.net')
      THEN
        INITCAP(
          REPLACE(
            REPLACE(
              REPLACE(
                -- Extract domain: strip protocol, www., path, and TLD
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(website, '^https?://', ''),
                      '^www\.', ''
                    ),
                    '/.*$', ''
                  ),
                  '\.(com|net|org|io|co|ai|us|uk|ca|au|nz|ae|za|se|nl|br|fj|school|pro)(\.[a-z]{2})?$', ''
                ),
                '-', ' '
              ),
              '_', ' '
            ),
            '.', ' '
          )
        )
      -- Priority 2: Extract from email domain (skip common providers)
      WHEN email IS NOT NULL
        AND SPLIT_PART(email, '@', 2) NOT IN (
          'gmail.com', 'yahoo.com', 'hotmail.com', 'aol.com', 'outlook.com',
          'proton.me', 'icloud.com', 'live.com', 'yahoo.com.au', 'hotmail.se',
          'bellsouth.net', 'mac.com', 'hotmail.com', 'webxio.pro',
          'leabro.com', 'coursora.com'
        )
      THEN
        INITCAP(
          REPLACE(
            REPLACE(
              REPLACE(
                REGEXP_REPLACE(
                  SPLIT_PART(SPLIT_PART(email, '@', 2), '.', 1),
                  '[0-9]+$', ''
                ),
                '-', ' '
              ),
              '_', ' '
            ),
            '.', ' '
          )
        )
      ELSE NULL
    END AS new_name
  FROM valuation_leads
  WHERE business_name IS NULL
     OR business_name ~ '''s Business$'
) derived
WHERE valuation_leads.id = derived.id
  AND derived.new_name IS NOT NULL
  AND derived.new_name != '';

-- ─── 4. Auto-duplicate prevention trigger ───
-- On INSERT, if a non-excluded row with the same email+calculator_type exists,
-- mark the new row as excluded with reason 'duplicate'.
CREATE OR REPLACE FUNCTION prevent_valuation_lead_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.excluded = false THEN
    IF EXISTS (
      SELECT 1 FROM valuation_leads
      WHERE LOWER(email) = LOWER(NEW.email)
        AND calculator_type = NEW.calculator_type
        AND excluded = false
        AND id != NEW.id
    ) THEN
      NEW.excluded := true;
      NEW.exclusion_reason := 'duplicate';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_valuation_lead_duplicates ON valuation_leads;
CREATE TRIGGER check_valuation_lead_duplicates
  BEFORE INSERT ON valuation_leads
  FOR EACH ROW
  EXECUTE FUNCTION prevent_valuation_lead_duplicates();

-- ============================================================
-- Summary:
--   1. Un-excluded all Auto Shop leads
--   2. Deduplicated by email+calculator_type (kept most recent)
--   3. Extracted business names from email/website domains
--   4. Added trigger to auto-exclude future duplicate submissions
-- ============================================================
