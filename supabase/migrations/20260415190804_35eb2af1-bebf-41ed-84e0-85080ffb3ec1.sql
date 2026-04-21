
-- =====================================================
-- 1. Create hydrate_profile_from_metadata RPC
-- This reads raw_user_meta_data from auth.users and writes to profiles
-- SECURITY DEFINER so it works even without a valid session (pre-verification)
-- =====================================================
CREATE OR REPLACE FUNCTION public.hydrate_profile_from_metadata(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_email text;
BEGIN
  -- Read metadata from auth.users
  SELECT raw_user_meta_data, email
  INTO v_meta, v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_meta IS NULL THEN
    RETURN; -- No metadata to hydrate from
  END IF;

  -- Update the profile with ALL fields from metadata
  -- Only updates non-null/non-empty metadata values, preserves existing data
  UPDATE public.profiles SET
    first_name = COALESCE(NULLIF(v_meta->>'first_name', ''), first_name),
    last_name = COALESCE(NULLIF(v_meta->>'last_name', ''), last_name),
    company = COALESCE(NULLIF(v_meta->>'company', ''), company),
    buyer_type = COALESCE(NULLIF(v_meta->>'buyer_type', ''), buyer_type),
    website = COALESCE(NULLIF(v_meta->>'website', ''), website),
    linkedin_profile = COALESCE(NULLIF(v_meta->>'linkedin_profile', ''), linkedin_profile),
    phone_number = COALESCE(NULLIF(v_meta->>'phone_number', ''), phone_number),
    job_title = COALESCE(NULLIF(v_meta->>'job_title', ''), job_title),
    referral_source = COALESCE(NULLIF(v_meta->>'referral_source', ''), referral_source),
    referral_source_detail = COALESCE(NULLIF(v_meta->>'referral_source_detail', ''), referral_source_detail)
  WHERE id = p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'hydrate_profile_from_metadata failed for %: % %', p_user_id, SQLSTATE, SQLERRM;
END;
$$;

-- Grant execute to authenticated and anon (anon needed for pre-verification calls)
GRANT EXECUTE ON FUNCTION public.hydrate_profile_from_metadata(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hydrate_profile_from_metadata(uuid) TO anon;


-- =====================================================
-- 2. Rewrite handle_new_user to remove broken column references
-- This is the CRITICAL fix — restores core field insertion
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_meta jsonb;
  v_first_name text;
  v_last_name text;
  v_company text;
  v_buyer_type text;
  v_website text;
  v_linkedin text;
  v_phone text;
  v_job_title text;
  v_referral_source text;
  v_referral_source_detail text;
  v_visitor_id text;
BEGIN
  v_user_id := NEW.id;
  v_email := COALESCE(NEW.email, '');
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Extract fields from metadata
  v_first_name := COALESCE(NULLIF(TRIM(v_meta->>'first_name'), ''), 'Unknown');
  v_last_name := COALESCE(NULLIF(TRIM(v_meta->>'last_name'), ''), 'User');
  v_company := COALESCE(v_meta->>'company', '');
  v_buyer_type := COALESCE(NULLIF(v_meta->>'buyer_type', ''), 'individual');
  v_website := COALESCE(v_meta->>'website', '');
  v_linkedin := COALESCE(v_meta->>'linkedin_profile', '');
  v_phone := COALESCE(v_meta->>'phone_number', '');
  v_job_title := COALESCE(v_meta->>'job_title', '');
  v_referral_source := COALESCE(v_meta->>'referral_source', '');
  v_referral_source_detail := COALESCE(v_meta->>'referral_source_detail', '');
  v_visitor_id := v_meta->>'visitor_id';

  -- ===== STAGE 1: Insert profile with ALL core fields =====
  BEGIN
    INSERT INTO public.profiles (
      id, email, first_name, last_name,
      company, buyer_type, website, linkedin_profile,
      phone_number, job_title, referral_source, referral_source_detail,
      role, approval_status, email_verified
    ) VALUES (
      v_user_id, v_email, v_first_name, v_last_name,
      v_company, v_buyer_type, v_website, v_linkedin,
      v_phone, v_job_title, v_referral_source, v_referral_source_detail,
      'buyer', 'pending', false
    );
  EXCEPTION WHEN unique_violation THEN
    -- Profile already exists (e.g. from ensure_profile_exists), update it
    BEGIN
      UPDATE public.profiles SET
        first_name = COALESCE(NULLIF(v_first_name, 'Unknown'), first_name),
        last_name = COALESCE(NULLIF(v_last_name, 'User'), last_name),
        company = COALESCE(NULLIF(v_company, ''), company),
        buyer_type = COALESCE(NULLIF(v_buyer_type, 'individual'), buyer_type),
        website = COALESCE(NULLIF(v_website, ''), website),
        linkedin_profile = COALESCE(NULLIF(v_linkedin, ''), linkedin_profile),
        phone_number = COALESCE(NULLIF(v_phone, ''), phone_number),
        job_title = COALESCE(NULLIF(v_job_title, ''), job_title),
        referral_source = COALESCE(NULLIF(v_referral_source, ''), referral_source),
        referral_source_detail = COALESCE(NULLIF(v_referral_source_detail, ''), referral_source_detail)
      WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
        VALUES ('handle_new_user', 'update_existing_failed', 'warning',
          jsonb_build_object('user_id', v_user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  WHEN OTHERS THEN
    -- Full insert failed — try absolute minimal
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
      VALUES ('handle_new_user', 'full_insert_failed', 'warning',
        jsonb_build_object('user_id', v_user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO public.profiles (id, email, first_name, last_name)
      VALUES (v_user_id, v_email, v_first_name, v_last_name)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
        VALUES ('handle_new_user', 'minimal_insert_failed', 'error',
          jsonb_build_object('user_id', v_user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END;

  -- ===== STAGE 2: Link visitor journey (best-effort) =====
  IF v_visitor_id IS NOT NULL AND v_visitor_id != '' THEN
    BEGIN
      UPDATE public.user_journeys
      SET user_id = v_user_id
      WHERE visitor_id = v_visitor_id
        AND user_id IS NULL;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
        VALUES ('handle_new_user', 'journey_link_failed', 'warning',
          jsonb_build_object('user_id', v_user_id, 'visitor_id', v_visitor_id, 'error', SQLERRM));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;

  -- ===== STAGE 3: Attribution lookup (best-effort) =====
  BEGIN
    UPDATE public.profiles SET
      first_utm_source = uj.utm_source,
      first_referrer = uj.referrer,
      first_landing_page = uj.landing_page
    FROM public.user_journeys uj
    WHERE uj.user_id = v_user_id
      AND public.profiles.id = v_user_id
      AND uj.utm_source IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
      VALUES ('handle_new_user', 'attribution_lookup_failed', 'warning',
        jsonb_build_object('user_id', v_user_id, 'error', SQLERRM, 'sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- ===== STAGE 4: Cascade triggers (best-effort) =====
  -- Firm linkage
  BEGIN
    PERFORM public.resolve_user_firm_id(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
      VALUES ('handle_new_user', 'firm_linkage_failed', 'warning',
        jsonb_build_object('user_id', v_user_id, 'error', SQLERRM));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- Marketplace buyer sync
  BEGIN
    PERFORM public.sync_marketplace_buyer_on_signup(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
      VALUES ('handle_new_user', 'marketplace_sync_failed', 'warning',
        jsonb_build_object('user_id', v_user_id, 'error', SQLERRM));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- Lead linking
  BEGIN
    PERFORM public.link_leads_to_user(v_user_id, v_email);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
      VALUES ('handle_new_user', 'lead_linking_failed', 'warning',
        jsonb_build_object('user_id', v_user_id, 'error', SQLERRM));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- ===== Log success =====
  BEGIN
    INSERT INTO public.trigger_logs (trigger_name, event_type, status, payload)
    VALUES ('handle_new_user', 'signup_completed', 'success',
      jsonb_build_object(
        'user_id', v_user_id,
        'email', v_email,
        'has_company', v_company != '',
        'has_buyer_type', v_buyer_type != 'individual',
        'has_visitor_id', v_visitor_id IS NOT NULL
      ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;


-- =====================================================
-- 3. Simplify ensure_profile_exists to absolute minimal
-- =====================================================
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_first_name text;
  v_last_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if profile already exists (fast path)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RETURN;
  END IF;

  -- Read from auth.users
  SELECT
    COALESCE(u.email, ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''), 'Unknown'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), ''), 'User')
  INTO v_email, v_first_name, v_last_name
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- Insert minimal profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (v_user_id, v_email, v_first_name, v_last_name)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_profile_exists failed for %: % %', v_user_id, SQLSTATE, SQLERRM;
END;
$$;


-- =====================================================
-- 4. Backfill broken profiles from today
-- Reads auth metadata and hydrates any profiles missing core fields
-- =====================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.company IS NULL OR p.company = ''
      AND p.created_at > now() - interval '24 hours'
      AND u.raw_user_meta_data->>'company' IS NOT NULL
      AND u.raw_user_meta_data->>'company' != ''
  LOOP
    UPDATE public.profiles SET
      first_name = COALESCE(NULLIF(r.raw_user_meta_data->>'first_name', ''), first_name),
      last_name = COALESCE(NULLIF(r.raw_user_meta_data->>'last_name', ''), last_name),
      company = COALESCE(NULLIF(r.raw_user_meta_data->>'company', ''), company),
      buyer_type = COALESCE(NULLIF(r.raw_user_meta_data->>'buyer_type', ''), buyer_type),
      website = COALESCE(NULLIF(r.raw_user_meta_data->>'website', ''), website),
      linkedin_profile = COALESCE(NULLIF(r.raw_user_meta_data->>'linkedin_profile', ''), linkedin_profile),
      phone_number = COALESCE(NULLIF(r.raw_user_meta_data->>'phone_number', ''), phone_number),
      job_title = COALESCE(NULLIF(r.raw_user_meta_data->>'job_title', ''), job_title),
      referral_source = COALESCE(NULLIF(r.raw_user_meta_data->>'referral_source', ''), referral_source),
      referral_source_detail = COALESCE(NULLIF(r.raw_user_meta_data->>'referral_source_detail', ''), referral_source_detail)
    WHERE id = r.id;
  END LOOP;
END;
$$;
