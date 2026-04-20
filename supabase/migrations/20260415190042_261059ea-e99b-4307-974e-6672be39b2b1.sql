
-- ================================================
-- Rewrite handle_new_user with correct schema alignment
-- ================================================
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
  v_first_utm_source text := NULL;
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
  -- Only reads first_utm_source which exists on profiles
  -- =============================================
  BEGIN
    IF v_visitor_id IS NOT NULL AND v_visitor_id != '' THEN
      SELECT uj.first_utm_source
      INTO v_first_utm_source
      FROM public.user_journeys uj
      WHERE uj.visitor_id = v_visitor_id
      LIMIT 1;

      -- Fallback to user_sessions
      IF v_first_utm_source IS NULL THEN
        SELECT us.utm_source
        INTO v_first_utm_source
        FROM public.user_sessions us
        WHERE us.visitor_id = v_visitor_id
        ORDER BY us.started_at DESC
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'warn',
              'attribution_lookup_failed: ' || SQLERRM,
              jsonb_build_object('stage', 'attribution_lookup', 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- =============================================
  -- STAGE 3: Full profile INSERT (best-effort)
  -- =============================================
  BEGIN
    INSERT INTO public.profiles (
      id, email, first_name, last_name, company, website, phone_number,
      buyer_type, linkedin_profile, role, approval_status, email_verified,
      referral_source, referral_source_detail, first_utm_source
    ) VALUES (
      new_user_id, COALESCE(NEW.email, ''), v_first_name, v_last_name,
      v_company, v_website, v_phone,
      v_buyer_type, v_linkedin, 'buyer', 'pending', false,
      v_referral_source, v_referral_source_detail, v_first_utm_source
    );

    -- Log success
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'success', NULL,
              jsonb_build_object('stage', 'full_insert', 'email', COALESCE(NEW.email, '')));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

  EXCEPTION WHEN OTHERS THEN
    -- Full insert failed — attempt bare minimum fallback
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'warn',
              'full_insert_failed: ' || SQLERRM,
              jsonb_build_object('stage', 'full_insert_failed', 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      -- Absolute minimum: only truly required NOT NULL columns with no defaults
      INSERT INTO public.profiles (id, email, first_name, last_name)
      VALUES (
        new_user_id,
        COALESCE(NEW.email, ''),
        v_first_name,
        v_last_name
      );

      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
        VALUES ('handle_new_user', new_user_id, 'success', NULL,
                jsonb_build_object('stage', 'fallback_insert', 'email', COALESCE(NEW.email, '')));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

    EXCEPTION WHEN OTHERS THEN
      -- Even fallback failed — log but do NOT raise, so auth.users row still gets created
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
        VALUES ('handle_new_user', new_user_id, 'error',
                'fallback_insert_failed: ' || SQLERRM,
                jsonb_build_object('stage', 'fallback_insert_failed', 'sqlstate', SQLSTATE));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END;

  -- =============================================
  -- STAGE 4: Optional enrichment (fire-and-forget)
  -- Link journey to user
  -- =============================================
  BEGIN
    IF v_visitor_id IS NOT NULL AND v_visitor_id != '' THEN
      UPDATE public.user_journeys
      SET user_id = new_user_id, updated_at = now()
      WHERE visitor_id = v_visitor_id AND user_id IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, status, error_message, metadata)
      VALUES ('handle_new_user', new_user_id, 'warn',
              'journey_link_failed: ' || SQLERRM,
              jsonb_build_object('stage', 'journey_link', 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

-- ================================================
-- Rewrite ensure_profile_exists with minimal contract
-- ================================================
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

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_exists;
  
  IF v_exists THEN
    RETURN;
  END IF;

  SELECT 
    COALESCE(u.email, ''),
    COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'firstName', 'Unknown'),
    COALESCE(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'lastName', 'User')
  INTO v_email, v_first_name, v_last_name
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- Absolute minimum insert — let all defaults handle the rest
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (v_user_id, v_email, v_first_name, v_last_name)
  ON CONFLICT (id) DO NOTHING;
END;
$$;
