-- Create a safe trigger that handles JSON conversion errors gracefully
CREATE OR REPLACE FUNCTION public.safe_trigger_deal_alerts()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  listing_json JSONB;
  matching_alerts RECORD;
BEGIN
  -- Only process for INSERT operations on active listings
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    BEGIN
      -- Safely convert listing to JSON with error handling
      listing_json := jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'categories', COALESCE(array_to_json(NEW.categories), '[]'::json),
        'location', NEW.location,
        'revenue', NEW.revenue,
        'ebitda', NEW.ebitda,
        'description', NEW.description,
        'tags', COALESCE(array_to_json(NEW.tags), '[]'::json),
        'status', NEW.status,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at
      );
      
      -- Find matching alerts and send notifications
      FOR matching_alerts IN 
        SELECT * FROM public.match_deal_alerts_with_listing(listing_json)
      LOOP
        -- Only send instant alerts immediately
        IF matching_alerts.alert_frequency = 'instant' THEN
          -- Log the delivery attempt
          INSERT INTO public.alert_delivery_logs (alert_id, listing_id, user_id, delivery_status)
          VALUES (matching_alerts.alert_id, NEW.id, matching_alerts.user_id, 'pending');
        END IF;
      END LOOP;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the listing creation
      RAISE WARNING 'Deal alerts trigger failed for listing %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the safe trigger
CREATE TRIGGER safe_deal_alerts_trigger
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_trigger_deal_alerts();