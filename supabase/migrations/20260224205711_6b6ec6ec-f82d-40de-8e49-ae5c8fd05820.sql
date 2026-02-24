-- Soft-delete ALL remaining deals (including Closed Lost) with fake/placeholder websites
UPDATE deals
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND listing_id IN (
    SELECT id FROM listings 
    WHERE website LIKE 'unknown-%.placeholder'
       OR website LIKE '%.unknown'
  );