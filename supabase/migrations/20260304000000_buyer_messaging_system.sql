-- =============================================
-- Buyer Messaging System Enhancements
-- 1. Database view for server-side thread summaries (replaces client-side aggregation)
-- 2. Trigger to auto-insert system messages on connection request status changes
-- 3. Index for deal-owner routing (listing.primary_owner_id → admin's threads)
-- =============================================

-- ────────────────────────────────────────────
-- 1. Materialized thread summary view for admin Message Center
--    Replaces the client-side "fetch 2000 messages and group in JS" pattern
--    with a single efficient query.
-- ────────────────────────────────────────────

CREATE OR REPLACE VIEW public.message_thread_summaries AS
WITH latest_msg AS (
  SELECT DISTINCT ON (connection_request_id)
    connection_request_id,
    body   AS last_message_body,
    sender_role AS last_sender_role,
    created_at  AS last_message_at
  FROM public.connection_messages
  ORDER BY connection_request_id, created_at DESC
),
unread_counts AS (
  SELECT
    connection_request_id,
    COUNT(*) FILTER (WHERE sender_role = 'buyer' AND NOT is_read_by_admin) AS admin_unread,
    COUNT(*) FILTER (WHERE sender_role = 'admin' AND NOT is_read_by_buyer) AS buyer_unread,
    COUNT(*) AS total_messages
  FROM public.connection_messages
  GROUP BY connection_request_id
)
SELECT
  cr.id AS connection_request_id,
  cr.status AS request_status,
  cr.user_id AS buyer_user_id,
  cr.listing_id,
  -- Buyer info
  COALESCE(
    NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
    COALESCE(cr.lead_name, 'Unknown')
  ) AS buyer_name,
  COALESCE(p.company, cr.lead_company) AS buyer_company,
  COALESCE(p.email, cr.lead_email) AS buyer_email,
  -- Deal info
  l.title AS deal_title,
  l.primary_owner_id AS deal_owner_id,
  -- Message summary
  lm.last_message_body,
  lm.last_sender_role,
  lm.last_message_at,
  COALESCE(uc.admin_unread, 0)::int AS admin_unread_count,
  COALESCE(uc.buyer_unread, 0)::int AS buyer_unread_count,
  COALESCE(uc.total_messages, 0)::int AS total_messages
FROM public.connection_requests cr
JOIN latest_msg lm ON lm.connection_request_id = cr.id
LEFT JOIN unread_counts uc ON uc.connection_request_id = cr.id
LEFT JOIN public.profiles p ON p.id = cr.user_id
LEFT JOIN public.listings l ON l.id = cr.listing_id;

-- RLS on views is inherited from underlying tables, but grant access to authenticated users
GRANT SELECT ON public.message_thread_summaries TO authenticated;

-- ────────────────────────────────────────────
-- 2. Trigger: auto-insert system message when connection request status changes
--    This gives buyers visibility into what happened with their request
--    without the admin having to manually write a status message each time.
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_connection_request_status_message()
RETURNS TRIGGER AS $$
DECLARE
  status_label TEXT;
  msg_body TEXT;
BEGIN
  -- Only fire on actual status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Build human-readable message
  CASE NEW.status
    WHEN 'approved' THEN
      msg_body := 'Request approved. The documentation process will begin shortly.';
    WHEN 'rejected' THEN
      msg_body := 'Request declined.';
    WHEN 'on_hold'  THEN
      msg_body := 'Request placed on hold.';
    WHEN 'pending'  THEN
      msg_body := 'Request status reset to pending.';
    ELSE
      msg_body := 'Request status updated to ' || NEW.status || '.';
  END CASE;

  -- Insert system message; sender_id can be NULL for system messages
  -- We use the admin who made the change if available
  INSERT INTO public.connection_messages (
    connection_request_id,
    sender_id,
    sender_role,
    body,
    message_type,
    is_read_by_admin,
    is_read_by_buyer
  ) VALUES (
    NEW.id,
    COALESCE(
      CASE NEW.status
        WHEN 'approved' THEN NEW.approved_by
        WHEN 'rejected' THEN NEW.rejected_by
        WHEN 'on_hold'  THEN NEW.on_hold_by
        ELSE NULL
      END,
      auth.uid()
    ),
    'admin',
    msg_body,
    'system',
    true,   -- admin already knows
    false   -- buyer needs to see it
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_connection_request_status_message ON public.connection_requests;
CREATE TRIGGER trg_connection_request_status_message
  AFTER UPDATE OF status ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_connection_request_status_message();

-- ────────────────────────────────────────────
-- 3. Index to support deal-owner routing queries
--    (find threads where listing.primary_owner_id = current admin)
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_listings_primary_owner
  ON public.listings(primary_owner_id)
  WHERE primary_owner_id IS NOT NULL;

-- Composite index for the view's DISTINCT ON pattern
CREATE INDEX IF NOT EXISTS idx_connection_messages_request_created_desc
  ON public.connection_messages(connection_request_id, created_at DESC);
