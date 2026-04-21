
-- 1. Create the minimal profile repair RPC
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_first_name text;
  v_last_name text;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_exists;
  
  IF v_exists THEN
    RETURN; -- Profile exists, nothing to do
  END IF;

  -- Pull minimal info from auth.users
  SELECT 
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'firstName', 'Unknown'),
    COALESCE(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'lastName', 'User')
  INTO v_email, v_first_name, v_last_name
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- Create minimal profile
  INSERT INTO public.profiles (id, email, first_name, last_name, role, approval_status, email_verified)
  VALUES (v_user_id, v_email, v_first_name, v_last_name, 'buyer', 'pending', false)
  ON CONFLICT (id) DO NOTHING; -- Race condition guard
END;
$$;

-- 2. Rewrite handle_new_user with full isolation of every optional step
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid := NEW.id;
  v_first_name text;
  v_last_name text;
  v_company text;
  v_website text;
  v_phone text;
  v_buyer_type text;
  v_linkedin text;
  v_visitor_id text;
  v_referral_source text;
  v_referral_source_detail text;
  -- Attribution fields
  v_first_utm_source text := NULL;
  v_first_utm_medium text := NULL;
  v_first_utm_campaign text := NULL;
  v_first_external_referrer text := NULL;
  v_signup_page text := NULL;
  v_full_insert_ok boolean := false;
BEGIN
  -- =============================================
  -- STAGE 1: Extract core metadata (cannot fail)
  -- =============================================
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'firstName', 'Unknown');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'lastName', 'User');
  v_company := COALESCE(NEW.raw_user_meta_data->>'company', '');
  v_website := COALESCE(NEW.raw_user_meta_data->>'website', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phoneNumber', '');
  v_buyer_type := COALESCE(NEW.raw_user_meta_data->>'buyer_type', NEW.raw_user_meta_data->>'buyerType', 'individual');
  v_linkedin := COALESCE(NEW.raw_user_meta_data->>'linkedin_profile', NEW.raw_user_meta_data->>'linkedinProfile', '');
  v_visitor_id := NEW.raw_user_meta_data->>'visitor_id';
  v_referral_source := NEW.raw_user_meta_data->>'referral_source';
  v_referral_source_detail := NEW.raw_user_meta_data->>'referral_source_detail';

  -- =============================================
  -- STAGE 2: Attribution lookup (fully optional)
  -- =============================================
  BEGIN
    IF v_visitor_id IS NOT NULL AND v_visitor_id != '' THEN
      SELECT 
        uj.first_utm_source,
        uj.first_utm_medium,
        uj.first_utm_campaign,
        uj.first_external_referrer,
        uj.signup_page
      INTO
        v_first_utm_source,
        v_first_utm_medium,
        v_first_utm_campaign,
        v_first_external_referrer,
        v_signup_page
      FROM public.user_journeys uj
      WHERE uj.visitor_id = v_visitor_id
      LIMIT 1;

      -- Fallback to user_sessions if journey not found
      IF v_first_utm_source IS NULL THEN
        SELECT
          us.utm_source,
          us.utm_medium,
          us.utm_campaign,
          us.referrer,
          us.landing_page
        INTO
          v_first_utm_source,
          v_first_utm_medium,
          v_first_utm_campaign,
          v_first_external_referrer,
          v_signup_page
        FROM public.user_sessions us
        WHERE us.visitor_id = v_visitor_id
        ORDER BY us.started_at DESC
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Attribution lookup failed — proceed without it
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'warn', 
              'attribution_lookup_failed: ' || SQLERRM,
              jsonb_build_object('stage', 'attribution_lookup', 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- =============================================
  -- STAGE 3: Full profile INSERT (with fallback)
  -- =============================================
  BEGIN
    INSERT INTO public.profiles (
      id, email, first_name, last_name, company, website, phone_number,
      buyer_type, linkedin_profile, role, approval_status, email_verified,
      referral_source, referral_source_detail,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_external_referrer, signup_page
    ) VALUES (
      new_user_id, COALESCE(NEW.email, ''), v_first_name, v_last_name,
      v_company, v_website, v_phone,
      v_buyer_type, v_linkedin, 'buyer', 'pending', false,
      v_referral_source, v_referral_source_detail,
      v_first_utm_source, v_first_utm_medium, v_first_utm_campaign,
      v_first_external_referrer, v_signup_page
    );
    v_full_insert_ok := true;
  EXCEPTION WHEN OTHERS THEN
    -- Full insert failed — attempt minimal fallback
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'error', 
              'full_insert_failed: ' || SQLERRM,
              jsonb_build_object('stage', 'full_insert', 'sqlstate', SQLSTATE, 'email', COALESCE(NEW.email, '')));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO public.profiles (id, email, first_name, last_name, role, approval_status, email_verified)
      VALUES (new_user_id, COALESCE(NEW.email, ''), v_first_name, v_last_name, 'buyer', 'pending', false);
      v_full_insert_ok := true; -- fallback succeeded
    EXCEPTION WHEN OTHERS THEN
      -- Even fallback failed — log and let the RPC repair later
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
        VALUES ('handle_new_user', new_user_id, 'critical', 
                'fallback_insert_failed: ' || SQLERRM,
                jsonb_build_object('stage', 'fallback_insert', 'sqlstate', SQLSTATE, 'email', COALESCE(NEW.email, '')));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END;

  -- =============================================
  -- STAGE 4: Success logging (optional)
  -- =============================================
  BEGIN
    IF v_full_insert_ok THEN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, metadata)
      VALUES ('handle_new_user', new_user_id, 'success',
              jsonb_build_object('stage', 'complete', 'email', COALESCE(NEW.email, ''), 'buyer_type', v_buyer_type, 'has_attribution', v_first_utm_source IS NOT NULL));
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;
