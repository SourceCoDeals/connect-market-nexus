CREATE OR REPLACE FUNCTION public.create_listing_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved'
     AND OLD.status IS DISTINCT FROM 'approved'
     AND NEW.user_id IS NOT NULL
     AND NEW.listing_id IS NOT NULL THEN
    INSERT INTO public.listing_conversations (listing_id, connection_request_id, user_id, admin_id)
    VALUES (NEW.listing_id, NEW.id, NEW.user_id, NEW.approved_by)
    ON CONFLICT (connection_request_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;