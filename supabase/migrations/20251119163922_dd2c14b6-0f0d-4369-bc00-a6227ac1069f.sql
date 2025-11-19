-- Backfill: Create conversations for existing approved connection requests that don't have one yet
-- Use COALESCE to handle null timestamps

INSERT INTO listing_conversations (
  listing_id,
  connection_request_id,
  user_id,
  admin_id,
  created_at,
  updated_at
)
SELECT 
  cr.listing_id,
  cr.id,
  cr.user_id,
  COALESCE(l.presented_by_admin_id, l.primary_owner_id),
  COALESCE(cr.approved_at, cr.updated_at, cr.created_at, NOW()),
  COALESCE(cr.approved_at, cr.updated_at, cr.created_at, NOW())
FROM connection_requests cr
JOIN listings l ON l.id = cr.listing_id
WHERE cr.status = 'approved' 
  AND cr.user_id IS NOT NULL  -- Only for real users, not leads
  AND NOT EXISTS (
    SELECT 1 FROM listing_conversations lc 
    WHERE lc.connection_request_id = cr.id
  )
ON CONFLICT (connection_request_id) DO NOTHING;