
-- Create a function to reset all admin notification views
CREATE OR REPLACE FUNCTION reset_all_admin_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset connection requests views
  UPDATE admin_connection_requests_views
  SET last_viewed_at = NOW(), updated_at = NOW();
  
  -- Reset users views
  UPDATE admin_users_views
  SET last_viewed_at = NOW(), updated_at = NOW();
  
  -- Reset deal sourcing views
  UPDATE admin_deal_sourcing_views
  SET last_viewed_at = NOW(), updated_at = NOW();
END;
$$;

-- Execute the function to reset all notifications
SELECT reset_all_admin_notifications();
