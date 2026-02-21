-- ============================================================================
-- FIX: Deal alert trigger was neutered — restore email sending via net.http_post
--
-- The original trigger (20250728) used net.http_post to call send-deal-alert.
-- The safe trigger (20250806) removed the http_post call, so alerts are matched
-- and logged but emails are NEVER SENT. This restores email delivery while
-- keeping the safe error handling from the 20250806 version.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_trigger_deal_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  listing_json JSONB;
  matching_alerts RECORD;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only process for INSERT operations on active listings
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    BEGIN
      -- Resolve Supabase URL and service role key for edge function call
      supabase_url := COALESCE(
        current_setting('app.settings.supabase_url', true),
        current_setting('app.supabase_url', true)
      );
      service_key := COALESCE(
        current_setting('app.settings.service_role_key', true),
        current_setting('app.supabase_service_role_key', true)
      );

      -- If we can't resolve credentials, log and skip (don't break listing creation)
      IF supabase_url IS NULL OR service_key IS NULL THEN
        RAISE WARNING 'Deal alerts trigger: missing supabase_url or service_role_key settings';
        RETURN NEW;
      END IF;

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

          -- Call the edge function to send the email
          PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-deal-alert',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || service_key
            ),
            body := jsonb_build_object(
              'alert_id', matching_alerts.alert_id,
              'user_email', matching_alerts.user_email,
              'user_id', matching_alerts.user_id,
              'listing_id', NEW.id,
              'alert_name', matching_alerts.alert_name,
              'listing_data', listing_json
            )
          );
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

-- ============================================================================
-- Summary:
--   Restores net.http_post call to send-deal-alert edge function.
--   Uses dynamic supabase_url from app settings (no hardcoded URL).
--   Graceful error handling preserved — trigger failures never block listing creation.
-- ============================================================================
