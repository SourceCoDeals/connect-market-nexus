
-- Must clear FK references in valuation_leads FIRST before deleting listings
-- Step 1: Reset the accidentally-pushed valuation_leads (clears the FK reference)
UPDATE valuation_leads
SET 
  pushed_to_all_deals = false,
  pushed_to_all_deals_at = NULL,
  pushed_listing_id = NULL,
  status = 'new'
WHERE pushed_to_all_deals_at >= '2026-02-19 04:54:00+00'
  AND pushed_to_all_deals_at <= '2026-02-19 04:55:00+00';

-- Step 2: Now delete the orphaned listings that were auto-created by the bug
DELETE FROM listings
WHERE created_at >= '2026-02-19 04:54:00+00'
  AND created_at <= '2026-02-19 04:55:00+00'
  AND is_internal_deal = true;
