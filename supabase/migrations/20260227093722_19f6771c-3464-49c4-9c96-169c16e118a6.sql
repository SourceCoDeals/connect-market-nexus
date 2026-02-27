-- Backfill linkedin_verified_at for all listings that have LinkedIn data
-- but are missing the timestamp. This ensures the 6-month cooldown logic
-- works correctly and prevents unnecessary re-scraping.
UPDATE listings
SET linkedin_verified_at = NOW()
WHERE linkedin_verified_at IS NULL
  AND (
    linkedin_url IS NOT NULL
    OR linkedin_employee_count IS NOT NULL
    OR linkedin_match_confidence IS NOT NULL
  );