-- Add is_internal_deal flag to listings table
ALTER TABLE listings 
  ADD COLUMN IF NOT EXISTS is_internal_deal BOOLEAN DEFAULT false;

-- Backfill: Mark deals that appear to be research deals
-- (created recently without remarketing link, low/zero financials)
UPDATE listings
SET is_internal_deal = true
WHERE id NOT IN (
  SELECT DISTINCT listing_id 
  FROM remarketing_universe_deals 
  WHERE listing_id IS NOT NULL
)
AND (revenue = 0 OR revenue IS NULL OR ebitda = 0)
AND created_at > '2026-02-01';