-- Soft-delete active deals whose listings have placeholder/fake websites
-- This does NOT touch the listings table or marketplace visibility
UPDATE deals
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND stage_id IN (
    SELECT id FROM deal_stages WHERE stage_type = 'active'
  )
  AND listing_id IN (
    SELECT id FROM listings 
    WHERE website LIKE 'unknown-%.placeholder'
       OR website LIKE '%.unknown'
  );