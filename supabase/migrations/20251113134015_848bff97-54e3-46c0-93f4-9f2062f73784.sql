-- Create edge function trigger for deal reassignment notifications
-- This handles sending email when assigned_to changes

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
    
    -- Get deal and listing titles
    v_deal_title := NEW.title;
    SELECT title INTO v_listing_title
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
        'new_owner_id', NEW.assigned_to,
        'deal_id', NEW.id,
        'listing_id', NEW.listing_id
      )
    );
    
    -- Invoke edge function to send email (async, don't block on failure)
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-deal-reassignment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'dealId', NEW.id,
        'dealTitle', v_deal_title,
        'listingTitle', v_listing_title,
        'previousOwnerId', OLD.assigned_to,
        'previousOwnerName', v_previous_owner_name,
        'previousOwnerEmail', v_previous_owner_email,
        'newOwnerId', NEW.assigned_to,
        'newOwnerName', v_new_owner_name,
        'newOwnerEmail', v_new_owner_email
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for deal reassignment
DROP TRIGGER IF EXISTS trigger_notify_deal_reassignment ON deals;
CREATE TRIGGER trigger_notify_deal_reassignment
  AFTER UPDATE OF assigned_to ON deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_deal_reassignment();

-- Add function to auto-assign new deals based on listing history
CREATE OR REPLACE FUNCTION auto_assign_deal_from_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggested_owner uuid;
BEGIN
  -- Only auto-assign if deal is being created without an owner and has a listing
  IF NEW.assigned_to IS NULL AND NEW.listing_id IS NOT NULL THEN
    -- Find the most recent deal owner for this listing
    SELECT assigned_to INTO v_suggested_owner
    FROM deals
    WHERE listing_id = NEW.listing_id
      AND assigned_to IS NOT NULL
      AND id != NEW.id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If we found a suggested owner, assign them
    IF v_suggested_owner IS NOT NULL THEN
      NEW.assigned_to := v_suggested_owner;
      NEW.owner_assigned_at := now();
      NEW.owner_assigned_by := v_suggested_owner; -- Self-assigned by system
      
      -- Create notification for the auto-assigned admin
      INSERT INTO admin_notifications (
        admin_id,
        deal_id,
        title,
        message,
        action_url,
        notification_type,
        metadata
      ) VALUES (
        v_suggested_owner,
        NEW.id,
        'New Deal Auto-Assigned',
        'A new deal "' || NEW.title || '" has been automatically assigned to you based on your previous work with this listing',
        '/admin/pipeline?deal=' || NEW.id,
        'deal_auto_assigned',
        jsonb_build_object(
          'deal_id', NEW.id,
          'listing_id', NEW.listing_id,
          'reason', 'previous_listing_owner'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_deal ON deals;
CREATE TRIGGER trigger_auto_assign_deal
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_deal_from_listing();

COMMENT ON FUNCTION notify_deal_reassignment() IS 'Sends notifications when a deal is reassigned to a different owner';
COMMENT ON FUNCTION auto_assign_deal_from_listing() IS 'Auto-assigns new deals to the admin who handled previous deals for the same listing';