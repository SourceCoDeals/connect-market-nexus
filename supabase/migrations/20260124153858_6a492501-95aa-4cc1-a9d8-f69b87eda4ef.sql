-- Fix scores without universe_id by assigning them to the most appropriate universe based on buyer
-- First, update scores that have a buyer with a universe_id
UPDATE remarketing_scores rs
SET universe_id = rb.universe_id
FROM remarketing_buyers rb
WHERE rs.buyer_id = rb.id
AND rs.universe_id IS NULL
AND rb.universe_id IS NOT NULL;

-- Now create missing universe_deal links for all remaining scores with universe_id
INSERT INTO remarketing_universe_deals (universe_id, listing_id, status, added_at)
SELECT DISTINCT rs.universe_id, rs.listing_id, 'active', NOW()
FROM remarketing_scores rs
WHERE rs.universe_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM remarketing_universe_deals rud 
  WHERE rud.universe_id = rs.universe_id 
  AND rud.listing_id = rs.listing_id
)
ON CONFLICT DO NOTHING;