
-- ============================================================
-- 1. Create save_extended_profile RPC (SECURITY DEFINER)
--    Accepts a user_id + jsonb payload and writes extended
--    profile fields. Bypasses RLS so it works pre-verification.
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_extended_profile(
  p_user_id uuid,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Validate user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- Update profiles with only the fields present in p_data
  UPDATE public.profiles SET
    ideal_target_description = COALESCE(p_data->>'ideal_target_description', ideal_target_description),
    business_categories = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'business_categories') x), business_categories),
    target_locations = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'target_locations') x), target_locations),
    revenue_range_min = COALESCE((p_data->>'revenue_range_min')::numeric, revenue_range_min),
    revenue_range_max = COALESCE((p_data->>'revenue_range_max')::numeric, revenue_range_max),
    specific_business_search = COALESCE(p_data->>'specific_business_search', specific_business_search),
    estimated_revenue = COALESCE(p_data->>'estimated_revenue', estimated_revenue),
    fund_size = COALESCE(p_data->>'fund_size', fund_size),
    investment_size = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'investment_size') x), investment_size),
    aum = COALESCE(p_data->>'aum', aum),
    is_funded = COALESCE(p_data->>'is_funded', is_funded),
    funded_by = COALESCE(p_data->>'funded_by', funded_by),
    target_company_size = COALESCE(p_data->>'target_company_size', target_company_size),
    funding_source = COALESCE(p_data->>'funding_source', funding_source),
    needs_loan = COALESCE(p_data->>'needs_loan', needs_loan),
    ideal_target = COALESCE(p_data->>'ideal_target', ideal_target),
    deploying_capital_now = COALESCE(p_data->>'deploying_capital_now', deploying_capital_now),
    owning_business_unit = COALESCE(p_data->>'owning_business_unit', owning_business_unit),
    deal_size_band = COALESCE(p_data->>'deal_size_band', deal_size_band),
    integration_plan = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'integration_plan') x), integration_plan),
    corpdev_intent = COALESCE(p_data->>'corpdev_intent', corpdev_intent),
    discretion_type = COALESCE(p_data->>'discretion_type', discretion_type),
    committed_equity_band = COALESCE(p_data->>'committed_equity_band', committed_equity_band),
    equity_source = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'equity_source') x), equity_source),
    deployment_timing = COALESCE(p_data->>'deployment_timing', deployment_timing),
    target_deal_size_min = COALESCE((p_data->>'target_deal_size_min')::numeric, target_deal_size_min),
    target_deal_size_max = COALESCE((p_data->>'target_deal_size_max')::numeric, target_deal_size_max),
    geographic_focus = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'geographic_focus') x), geographic_focus),
    permanent_capital = COALESCE((p_data->>'permanent_capital')::boolean, permanent_capital),
    operating_company_targets = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'operating_company_targets') x), operating_company_targets),
    flex_subxm_ebitda = COALESCE((p_data->>'flex_subxm_ebitda')::boolean, flex_subxm_ebitda),
    search_type = COALESCE(p_data->>'search_type', search_type),
    acq_equity_band = COALESCE(p_data->>'acq_equity_band', acq_equity_band),
    financing_plan = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'financing_plan') x), financing_plan),
    search_stage = COALESCE(p_data->>'search_stage', search_stage),
    flex_sub2m_ebitda = COALESCE((p_data->>'flex_sub2m_ebitda')::boolean, flex_sub2m_ebitda),
    on_behalf_of_buyer = COALESCE(p_data->>'on_behalf_of_buyer', on_behalf_of_buyer),
    buyer_role = COALESCE(p_data->>'buyer_role', buyer_role),
    buyer_org_url = COALESCE(p_data->>'buyer_org_url', buyer_org_url),
    owner_timeline = COALESCE(p_data->>'owner_timeline', owner_timeline),
    owner_intent = COALESCE(p_data->>'owner_intent', owner_intent),
    uses_bank_finance = COALESCE(p_data->>'uses_bank_finance', uses_bank_finance),
    max_equity_today_band = COALESCE(p_data->>'max_equity_today_band', max_equity_today_band),
    mandate_blurb = COALESCE(p_data->>'mandate_blurb', mandate_blurb),
    portfolio_company_addon = COALESCE(p_data->>'portfolio_company_addon', portfolio_company_addon),
    backers_summary = COALESCE(p_data->>'backers_summary', backers_summary),
    anchor_investors_summary = COALESCE(p_data->>'anchor_investors_summary', anchor_investors_summary),
    deal_intent = COALESCE(p_data->>'deal_intent', deal_intent),
    exclusions = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'exclusions') x), exclusions),
    include_keywords = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'include_keywords') x), include_keywords),
    deal_sourcing_methods = COALESCE((SELECT array_agg(x)::text[] FROM jsonb_array_elements_text(p_data->'deal_sourcing_methods') x), deal_sourcing_methods),
    target_acquisition_volume = COALESCE(p_data->>'target_acquisition_volume', target_acquisition_volume)
  WHERE id = p_user_id;
END;
$$;

-- Grant to both anon (pre-verification) and authenticated
GRANT EXECUTE ON FUNCTION public.save_extended_profile(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.save_extended_profile(uuid, jsonb) TO authenticated;

-- ============================================================
-- 2. Fix handle_new_user trigger logging (event_type/payload → correct columns)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
        VALUES ('handle_new_user', v_user_id, v_email, 'warning',
          'update_existing_failed: ' || SQLERRM,
          jsonb_build_object('sqlstate', SQLSTATE));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  WHEN OTHERS THEN
    -- Full insert failed — log and try minimal
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
      VALUES ('handle_new_user', v_user_id, v_email, 'warning',
        'full_insert_failed: ' || SQLERRM,
        jsonb_build_object('sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO public.profiles (id, email, first_name, last_name)
      VALUES (v_user_id, v_email, v_first_name, v_last_name)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
        VALUES ('handle_new_user', v_user_id, v_email, 'error',
          'minimal_insert_failed: ' || SQLERRM,
          jsonb_build_object('sqlstate', SQLSTATE));
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
        INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
        VALUES ('handle_new_user', v_user_id, v_email, 'warning',
          'journey_link_failed: ' || SQLERRM,
          jsonb_build_object('visitor_id', v_visitor_id));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;

  -- ===== STAGE 3: Marketplace buyer sync (best-effort) =====
  BEGIN
    PERFORM public.sync_marketplace_buyer(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
      VALUES ('handle_new_user', v_user_id, v_email, 'warning',
        'marketplace_sync_failed: ' || SQLERRM,
        jsonb_build_object('sqlstate', SQLSTATE));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- ===== STAGE 4: Link existing leads (best-effort) =====
  BEGIN
    UPDATE public.connection_requests
    SET profile_id = v_user_id
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
      AND profile_id IS NULL;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
      VALUES ('handle_new_user', v_user_id, v_email, 'warning',
        'lead_link_failed: ' || SQLERRM, NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- ===== Success log =====
  BEGIN
    INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, success, metadata)
    VALUES ('handle_new_user', v_user_id, v_email, 'success', true,
      jsonb_build_object('company', v_company, 'buyer_type', v_buyer_type));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Tighten hydrate_profile_from_metadata: revoke anon
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.hydrate_profile_from_metadata(uuid) FROM anon;
