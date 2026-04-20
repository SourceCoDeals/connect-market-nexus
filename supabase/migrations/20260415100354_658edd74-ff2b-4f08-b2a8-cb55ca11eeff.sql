-- Fix: guard against NULL user_id for external leads (no registered user)

CREATE OR REPLACE FUNCTION public.notify_user_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'status_changed',
      CASE 
        WHEN NEW.status = 'approved' THEN 'Connection Request Approved'
        WHEN NEW.status = 'rejected' THEN 'Connection Request Declined'
        WHEN NEW.status = 'on_hold' THEN 'Connection Request On Hold'
        ELSE 'Connection Request Updated'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Great news! Your connection request has been approved.'
        WHEN NEW.status = 'rejected' THEN 'Your connection request was declined. Continue exploring other opportunities.'
        WHEN NEW.status = 'on_hold' THEN 'Your connection request is currently on hold pending review.'
        ELSE 'Your connection request status has been updated.'
      END,
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_user_on_admin_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (OLD.admin_comment IS DISTINCT FROM NEW.admin_comment) 
     AND (NEW.admin_comment IS NOT NULL AND NEW.admin_comment != '') THEN
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'admin_message',
      'New Message from Admin',
      'You have a new message regarding your connection request.',
      jsonb_build_object(
        'listing_id', NEW.listing_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.notify_user_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  stage_name TEXT;
BEGIN
  IF NEW.user_id IS NOT NULL AND OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id THEN
    SELECT name INTO stage_name 
    FROM public.connection_request_stages 
    WHERE id = NEW.pipeline_stage_id;
    
    INSERT INTO public.user_notifications (
      user_id, 
      connection_request_id, 
      notification_type, 
      title, 
      message,
      metadata
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'stage_updated',
      'Deal Stage Updated',
      'Your deal has moved to: ' || COALESCE(stage_name, 'a new stage'),
      jsonb_build_object(
        'listing_id', NEW.listing_id,
        'stage_id', NEW.pipeline_stage_id,
        'stage_name', stage_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;