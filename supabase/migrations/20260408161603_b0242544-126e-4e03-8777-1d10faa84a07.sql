CREATE OR REPLACE FUNCTION notify_user_on_connection_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip notification for anonymous leads (no user_id)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

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
    'request_created',
    'Connection Request Submitted',
    'Your connection request has been submitted and is under review.',
    jsonb_build_object(
      'listing_id', NEW.listing_id,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;