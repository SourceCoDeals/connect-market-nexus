-- Phase 3: Update handle_new_user trigger to copy attribution from user_journeys to profiles

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_meta jsonb;
  v_buyer_type text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_linkedin text;
  v_website text;
  v_company text;
  v_categories jsonb;
  v_locations jsonb;
  v_revenue_min text;
  v_revenue_max text;
  v_ideal_target text;
  v_specific_search text;
  v_referral_source text;
  v_referral_detail text;
  v_job_title text;
  v_fund_size text;
  v_investment_size jsonb;
  v_aum text;
  v_search_type text;
  v_acq_equity_band text;
  v_financing_plan jsonb;
  v_flex_sub2m boolean;
  v_anchor_investors text;
  v_search_stage text;
  v_estimated_revenue text;
  v_owning_business_unit text;
  v_deal_size_band text;
  v_integration_plan jsonb;
  v_corpdev_intent text;
  v_portfolio_addon text;
  v_deploying_capital text;
  v_discretion_type text;
  v_permanent_capital boolean;
  v_operating_targets jsonb;
  v_committed_equity_band text;
  v_equity_source jsonb;
  v_flex_subxm boolean;
  v_backers_summary text;
  v_deployment_timing text;
  v_funding_source text;
  v_needs_loan text;
  v_max_equity_today text;
  v_uses_bank_finance text;
  v_on_behalf_of text;
  v_buyer_role text;
  v_buyer_org_url text;
  v_mandate_blurb text;
  v_owner_intent text;
  v_owner_timeline text;
  v_deal_intent text;
  v_exclusions jsonb;
  v_include_keywords jsonb;
  v_deal_sourcing_methods jsonb;
  v_target_acquisition_volume text;
  -- Attribution fields
  v_visitor_id text;
  v_first_external_referrer text;
  v_first_blog_landing text;
  v_first_seen_at timestamptz;
  v_first_utm_source text;
BEGIN
  -- Extract the raw metadata
  v_raw_meta := NEW.raw_user_meta_data;
  
  -- Extract common fields
  v_buyer_type := COALESCE(v_raw_meta->>'buyer_type', 'corporate');
  v_first_name := COALESCE(v_raw_meta->>'first_name', '');
  v_last_name := COALESCE(v_raw_meta->>'last_name', '');
  v_phone := COALESCE(v_raw_meta->>'phone_number', '');
  v_linkedin := COALESCE(v_raw_meta->>'linkedin_profile', '');
  v_website := COALESCE(v_raw_meta->>'website', '');
  v_company := COALESCE(v_raw_meta->>'company', '');
  v_job_title := COALESCE(v_raw_meta->>'job_title', '');
  v_referral_source := v_raw_meta->>'referral_source';
  v_referral_detail := v_raw_meta->>'referral_source_detail';
  v_ideal_target := v_raw_meta->>'ideal_target_description';
  v_specific_search := v_raw_meta->>'specific_business_search';
  v_revenue_min := v_raw_meta->>'revenue_range_min';
  v_revenue_max := v_raw_meta->>'revenue_range_max';
  v_deal_intent := v_raw_meta->>'deal_intent';
  
  -- Handle arrays safely as jsonb
  v_categories := CASE 
    WHEN v_raw_meta->'business_categories' IS NOT NULL 
    THEN v_raw_meta->'business_categories'
    ELSE '[]'::jsonb
  END;
  
  v_locations := CASE 
    WHEN v_raw_meta->'target_locations' IS NOT NULL 
    THEN v_raw_meta->'target_locations'
    ELSE '[]'::jsonb
  END;
  
  v_exclusions := CASE 
    WHEN v_raw_meta->'exclusions' IS NOT NULL 
    THEN v_raw_meta->'exclusions'
    ELSE '[]'::jsonb
  END;
  
  v_include_keywords := CASE 
    WHEN v_raw_meta->'include_keywords' IS NOT NULL 
    THEN v_raw_meta->'include_keywords'
    ELSE '[]'::jsonb
  END;
  
  -- Deal sourcing fields
  v_deal_sourcing_methods := CASE 
    WHEN v_raw_meta->'deal_sourcing_methods' IS NOT NULL 
    THEN v_raw_meta->'deal_sourcing_methods'
    ELSE '[]'::jsonb
  END;
  v_target_acquisition_volume := v_raw_meta->>'target_acquisition_volume';
  
  -- Extract buyer-type specific fields
  IF v_buyer_type = 'searchFund' THEN
    v_search_type := v_raw_meta->>'search_type';
    v_acq_equity_band := v_raw_meta->>'acq_equity_band';
    v_financing_plan := CASE 
      WHEN v_raw_meta->'financing_plan' IS NOT NULL 
      THEN v_raw_meta->'financing_plan'
      ELSE '[]'::jsonb
    END;
    v_flex_sub2m := COALESCE((v_raw_meta->>'flex_sub2m_ebitda')::boolean, false);
    v_anchor_investors := v_raw_meta->>'anchor_investors_summary';
    v_search_stage := v_raw_meta->>'search_stage';
  ELSIF v_buyer_type = 'corporate' THEN
    v_estimated_revenue := v_raw_meta->>'estimated_revenue';
    v_owning_business_unit := v_raw_meta->>'owning_business_unit';
    v_deal_size_band := v_raw_meta->>'deal_size_band';
    v_integration_plan := CASE 
      WHEN v_raw_meta->'integration_plan' IS NOT NULL 
      THEN v_raw_meta->'integration_plan'
      ELSE '[]'::jsonb
    END;
    v_corpdev_intent := v_raw_meta->>'corpdev_intent';
  ELSIF v_buyer_type = 'privateEquity' THEN
    v_fund_size := v_raw_meta->>'fund_size';
    v_investment_size := CASE 
      WHEN v_raw_meta->'investment_size' IS NOT NULL 
      THEN v_raw_meta->'investment_size'
      ELSE '[]'::jsonb
    END;
    v_aum := v_raw_meta->>'aum';
    v_portfolio_addon := v_raw_meta->>'portfolio_company_addon';
    v_deploying_capital := v_raw_meta->>'deploying_capital_now';
  ELSIF v_buyer_type = 'familyOffice' THEN
    v_fund_size := v_raw_meta->>'fund_size';
    v_investment_size := CASE 
      WHEN v_raw_meta->'investment_size' IS NOT NULL 
      THEN v_raw_meta->'investment_size'
      ELSE '[]'::jsonb
    END;
    v_aum := v_raw_meta->>'aum';
    v_discretion_type := v_raw_meta->>'discretion_type';
    v_permanent_capital := COALESCE((v_raw_meta->>'permanent_capital')::boolean, false);
    v_operating_targets := CASE 
      WHEN v_raw_meta->'operating_company_targets' IS NOT NULL 
      THEN v_raw_meta->'operating_company_targets'
      ELSE '[]'::jsonb
    END;
  ELSIF v_buyer_type = 'independentSponsor' THEN
    v_committed_equity_band := v_raw_meta->>'committed_equity_band';
    v_equity_source := CASE 
      WHEN v_raw_meta->'equity_source' IS NOT NULL 
      THEN v_raw_meta->'equity_source'
      ELSE '[]'::jsonb
    END;
    v_flex_subxm := COALESCE((v_raw_meta->>'flex_subxm_ebitda')::boolean, false);
    v_backers_summary := v_raw_meta->>'backers_summary';
    v_deployment_timing := v_raw_meta->>'deployment_timing';
  ELSIF v_buyer_type = 'individual' THEN
    v_funding_source := v_raw_meta->>'funding_source';
    v_needs_loan := v_raw_meta->>'needs_loan';
    v_max_equity_today := v_raw_meta->>'max_equity_today_band';
    v_uses_bank_finance := v_raw_meta->>'uses_bank_finance';
  ELSIF v_buyer_type = 'advisor' THEN
    v_on_behalf_of := v_raw_meta->>'on_behalf_of_buyer';
    v_buyer_role := v_raw_meta->>'buyer_role';
    v_buyer_org_url := v_raw_meta->>'buyer_org_url';
    v_mandate_blurb := v_raw_meta->>'mandate_blurb';
  ELSIF v_buyer_type = 'businessOwner' THEN
    v_owner_intent := v_raw_meta->>'owner_intent';
    v_owner_timeline := v_raw_meta->>'owner_timeline';
  END IF;
  
  -- Try to find attribution data from user_journeys via visitor_id
  -- First, check if visitor_id was passed in metadata (from frontend)
  v_visitor_id := v_raw_meta->>'visitor_id';
  
  IF v_visitor_id IS NOT NULL THEN
    -- Look up attribution from user_journeys
    SELECT 
      uj.first_external_referrer,
      uj.first_blog_landing,
      uj.first_seen_at,
      uj.first_utm_source
    INTO 
      v_first_external_referrer,
      v_first_blog_landing,
      v_first_seen_at,
      v_first_utm_source
    FROM user_journeys uj
    WHERE uj.visitor_id = v_visitor_id
    LIMIT 1;
  END IF;
  
  -- If no journey found, try to find from most recent user_session for this user
  IF v_first_external_referrer IS NULL THEN
    SELECT 
      us.original_external_referrer,
      us.blog_landing_page,
      us.started_at,
      us.utm_source
    INTO 
      v_first_external_referrer,
      v_first_blog_landing,
      v_first_seen_at,
      v_first_utm_source
    FROM user_sessions us
    WHERE us.user_id = NEW.id
    ORDER BY us.started_at ASC
    LIMIT 1;
  END IF;

  -- Insert into profiles with ON CONFLICT to handle race conditions
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    phone_number,
    linkedin_profile,
    website,
    company,
    buyer_type,
    role,
    job_title,
    referral_source,
    referral_source_detail,
    -- Profile fields
    ideal_target_description,
    business_categories,
    target_locations,
    revenue_range_min,
    revenue_range_max,
    specific_business_search,
    deal_intent,
    exclusions,
    include_keywords,
    -- Deal sourcing
    deal_sourcing_methods,
    target_acquisition_volume,
    -- Search Fund fields
    search_type,
    acq_equity_band,
    financing_plan,
    flex_sub2m_ebitda,
    anchor_investors_summary,
    search_stage,
    -- Corporate fields
    estimated_revenue,
    owning_business_unit,
    deal_size_band,
    integration_plan,
    corpdev_intent,
    -- PE fields
    fund_size,
    investment_size,
    aum,
    portfolio_company_addon,
    deploying_capital_now,
    -- Family Office fields
    discretion_type,
    permanent_capital,
    operating_company_targets,
    -- Independent Sponsor fields
    committed_equity_band,
    equity_source,
    flex_subxm_ebitda,
    backers_summary,
    deployment_timing,
    -- Individual fields
    funding_source,
    needs_loan,
    max_equity_today_band,
    uses_bank_finance,
    -- Advisor fields
    on_behalf_of_buyer,
    buyer_role,
    buyer_org_url,
    mandate_blurb,
    -- Business Owner fields
    owner_intent,
    owner_timeline,
    -- Attribution fields (from user_journeys)
    first_external_referrer,
    first_blog_landing,
    first_seen_at,
    first_utm_source,
    -- Meta fields
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_phone,
    v_linkedin,
    v_website,
    v_company,
    v_buyer_type,
    'buyer',
    v_job_title,
    v_referral_source,
    v_referral_detail,
    v_ideal_target,
    v_categories,
    v_locations,
    v_revenue_min,
    v_revenue_max,
    v_specific_search,
    v_deal_intent,
    v_exclusions,
    v_include_keywords,
    v_deal_sourcing_methods,
    v_target_acquisition_volume,
    v_search_type,
    v_acq_equity_band,
    v_financing_plan,
    v_flex_sub2m,
    v_anchor_investors,
    v_search_stage,
    v_estimated_revenue,
    v_owning_business_unit,
    v_deal_size_band,
    v_integration_plan,
    v_corpdev_intent,
    v_fund_size,
    v_investment_size,
    v_aum,
    v_portfolio_addon,
    v_deploying_capital,
    v_discretion_type,
    v_permanent_capital,
    v_operating_targets,
    v_committed_equity_band,
    v_equity_source,
    v_flex_subxm,
    v_backers_summary,
    v_deployment_timing,
    v_funding_source,
    v_needs_loan,
    v_max_equity_today,
    v_uses_bank_finance,
    v_on_behalf_of,
    v_buyer_role,
    v_buyer_org_url,
    v_mandate_blurb,
    v_owner_intent,
    v_owner_timeline,
    v_first_external_referrer,
    v_first_blog_landing,
    v_first_seen_at,
    v_first_utm_source,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), profiles.phone_number),
    linkedin_profile = COALESCE(NULLIF(EXCLUDED.linkedin_profile, ''), profiles.linkedin_profile),
    website = COALESCE(NULLIF(EXCLUDED.website, ''), profiles.website),
    company = COALESCE(NULLIF(EXCLUDED.company, ''), profiles.company),
    buyer_type = COALESCE(EXCLUDED.buyer_type, profiles.buyer_type),
    job_title = COALESCE(EXCLUDED.job_title, profiles.job_title),
    referral_source = COALESCE(EXCLUDED.referral_source, profiles.referral_source),
    referral_source_detail = COALESCE(EXCLUDED.referral_source_detail, profiles.referral_source_detail),
    ideal_target_description = COALESCE(EXCLUDED.ideal_target_description, profiles.ideal_target_description),
    business_categories = COALESCE(EXCLUDED.business_categories, profiles.business_categories),
    target_locations = COALESCE(EXCLUDED.target_locations, profiles.target_locations),
    revenue_range_min = COALESCE(EXCLUDED.revenue_range_min, profiles.revenue_range_min),
    revenue_range_max = COALESCE(EXCLUDED.revenue_range_max, profiles.revenue_range_max),
    specific_business_search = COALESCE(EXCLUDED.specific_business_search, profiles.specific_business_search),
    deal_intent = COALESCE(EXCLUDED.deal_intent, profiles.deal_intent),
    exclusions = COALESCE(EXCLUDED.exclusions, profiles.exclusions),
    include_keywords = COALESCE(EXCLUDED.include_keywords, profiles.include_keywords),
    deal_sourcing_methods = COALESCE(EXCLUDED.deal_sourcing_methods, profiles.deal_sourcing_methods),
    target_acquisition_volume = COALESCE(EXCLUDED.target_acquisition_volume, profiles.target_acquisition_volume),
    -- Attribution fields - only update if currently null
    first_external_referrer = COALESCE(profiles.first_external_referrer, EXCLUDED.first_external_referrer),
    first_blog_landing = COALESCE(profiles.first_blog_landing, EXCLUDED.first_blog_landing),
    first_seen_at = COALESCE(profiles.first_seen_at, EXCLUDED.first_seen_at),
    first_utm_source = COALESCE(profiles.first_utm_source, EXCLUDED.first_utm_source),
    updated_at = NOW();

  -- Log successful trigger execution
  INSERT INTO public.trigger_logs (trigger_name, user_id, success, details)
  VALUES ('handle_new_user', NEW.id, true, jsonb_build_object(
    'email', NEW.email,
    'buyer_type', v_buyer_type,
    'first_external_referrer', v_first_external_referrer,
    'first_blog_landing', v_first_blog_landing
  ));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  INSERT INTO public.trigger_logs (trigger_name, user_id, success, error_message, details)
  VALUES ('handle_new_user', NEW.id, false, SQLERRM, jsonb_build_object(
    'email', NEW.email,
    'sqlstate', SQLSTATE
  ));
  
  RAISE;
END;
$$;