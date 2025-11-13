-- Fix notify_deal_reassignment function to not use net.http_post
-- Instead, just create the notification and let the app handle the email

CREATE OR REPLACE FUNCTION notify_deal_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_owner_email text;
  v_previous_owner_name text;
  v_new_owner_email text;
  v_new_owner_name text;
  v_deal_title text;
  v_listing_title text;
  v_company_name text;
BEGIN
  -- Only proceed if assigned_to changed and there was a previous owner
  IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    -- Get previous owner details
    SELECT email, first_name || ' ' || last_name
    INTO v_previous_owner_email, v_previous_owner_name
    FROM profiles
    WHERE id = OLD.assigned_to;
    
    -- Get new owner details (if assigned)
    IF NEW.assigned_to IS NOT NULL THEN
      SELECT email, first_name || ' ' || last_name
      INTO v_new_owner_email, v_new_owner_name
      FROM profiles
      WHERE id = NEW.assigned_to;
    END IF;
    
    -- Get deal and listing details
    v_deal_title := NEW.title;
    SELECT title, real_company_name INTO v_listing_title, v_company_name
    FROM listings
    WHERE id = NEW.listing_id;
    
    -- Create in-app notification for previous owner
    INSERT INTO admin_notifications (
      admin_id,
      deal_id,
      title,
      message,
      action_url,
      notification_type,
      metadata
    ) VALUES (
      OLD.assigned_to,
      NEW.id,
      'Deal Reassigned',
      CASE 
        WHEN NEW.assigned_to IS NULL THEN 'Your deal "' || v_deal_title || '" has been unassigned'
        ELSE 'Your deal "' || v_deal_title || '" has been reassigned to ' || v_new_owner_name
      END,
      '/admin/pipeline?deal=' || NEW.id,
      'deal_reassignment',
      jsonb_build_object(
        'previous_owner_id', OLD.assigned_to,
        'previous_owner_name', v_previous_owner_name,
        'previous_owner_email', v_previous_owner_email,
        'new_owner_id', NEW.assigned_to,
        'new_owner_name', v_new_owner_name,
        'new_owner_email', v_new_owner_email,
        'deal_id', NEW.id,
        'deal_title', v_deal_title,
        'listing_id', NEW.listing_id,
        'listing_title', v_listing_title,
        'company_name', v_company_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;