-- Create trigger to send email for deal reassignment notifications
-- This will call the edge function when a deal_reassignment notification is created

CREATE OR REPLACE FUNCTION trigger_deal_reassignment_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Only process deal_reassignment notifications
  IF NEW.notification_type = 'deal_reassignment' THEN
    -- Queue edge function call using pg_cron or handle immediately
    -- For now, we'll rely on the app to poll notifications and send emails
    -- This is safer than using extensions that might not be enabled
    
    -- Mark that email needs to be sent
    UPDATE admin_notifications 
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{email_pending}',
      'true'::jsonb
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_send_reassignment_email ON admin_notifications;
CREATE TRIGGER trigger_send_reassignment_email
  AFTER INSERT ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_deal_reassignment_email();