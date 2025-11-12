-- Hard delete the Approved and Negotiation stages
DELETE FROM deal_stages 
WHERE name IN ('Approved', 'Negotiation');

-- Reindex positions to remove gaps and ensure sequential ordering
WITH reordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
  FROM deal_stages
  WHERE is_active = true
  ORDER BY position
)
UPDATE deal_stages
SET position = reordered.new_position,
    updated_at = now()
FROM reordered
WHERE deal_stages.id = reordered.id;