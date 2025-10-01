-- One-time sync of all existing follow-up data from connection_requests to deals
UPDATE deals d
SET 
  followed_up = cr.followed_up,
  followed_up_at = cr.followed_up_at,
  followed_up_by = cr.followed_up_by,
  negative_followed_up = COALESCE(cr.negative_followed_up, false),
  negative_followed_up_at = cr.negative_followed_up_at,
  negative_followed_up_by = cr.negative_followed_up_by,
  updated_at = NOW()
FROM connection_requests cr
WHERE d.connection_request_id = cr.id
  AND (
    d.followed_up IS DISTINCT FROM cr.followed_up
    OR d.followed_up_at IS DISTINCT FROM cr.followed_up_at
    OR d.followed_up_by IS DISTINCT FROM cr.followed_up_by
    OR d.negative_followed_up IS DISTINCT FROM COALESCE(cr.negative_followed_up, false)
    OR d.negative_followed_up_at IS DISTINCT FROM cr.negative_followed_up_at
    OR d.negative_followed_up_by IS DISTINCT FROM cr.negative_followed_up_by
  );