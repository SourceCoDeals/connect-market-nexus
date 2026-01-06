
-- Fix handle_new_user trigger: cast text[] arrays to jsonb for columns that are jsonb type
-- This fixes the error: "column business_categories is of type jsonb but expression is of type text[]"

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_company text;
  v_buyer_type text;
  v_website text;
  v_linkedin_profile text;
  v_phone_number text;
  v_job_title text;
  v_business_categories text[];
  v_target_locations text[];
  v_investment_size text[];
  v_geographic_focus text[];
  v_industry_expertise text[];
  v_ideal_target_description text;
  v_revenue_range_min text;
  v_revenue_range_max text;
  v_specific_business_search text;
  v_estimated_revenue text;
  v_fund_size text;
  v_aum text;
  v_is_funded text;
  v_funded_by text;
  v_target_company_size text;
  v_funding_source text;
  v_needs_loan text;
  v_ideal_target text;
  v_deploying_capital_now text;
  v_owning_business_unit text;
  v_deal_size_band text;
  v_integration_plan text[];
  v_corpdev_intent text;
  v_discretion_type text;
  v_committed_equity_band text;
  v_equity_source text[];
  v_deployment_timing text;
  v_target_deal_size_min bigint;
  v_target_deal_size_max bigint;
  v_deal_structure_preference text;
  v_permanent_capital boolean;
  v_operating_company_targets text[];
  v_flex_subxm_ebitda boolean;
  v_search_type text;
  v_acq_equity_band text;
  v_financing_plan text[];
  v_search_stage text;
  v_flex_sub2m_ebitda boolean;
  v_on_behalf_of_buyer text;
  v_buyer_role text;
  v_buyer_org_url text;
  v_owner_timeline text;
  v_owner_intent text;
  v_uses_bank_finance text;
  v_max_equity_today_band text;
  v_mandate_blurb text;
  v_portfolio_company_addon text;
  v_backers_summary text;
  v_anchor_investors_summary text;
  v_deal_intent text;
  v_exclusions text[];
  v_include_keywords text[];
  -- Step 3 fields
  v_referral_source text;
  v_referral_source_detail text;
  v_deal_sourcing_methods text[];
  v_target_acquisition_volume text;
BEGIN
  -- Safely extract values from metadata with COALESCE
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'firstName', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'lastName', '');
  v_company := COALESCE(NEW.raw_user_meta_data->>'company', '');
  v_buyer_type := COALESCE(NEW.raw_user_meta_data->>'buyer_type', NEW.raw_user_meta_data->>'buyerType', 'individual');
  v_website := COALESCE(NEW.raw_user_meta_data->>'website', '');
  v_linkedin_profile := COALESCE(NEW.raw_user_meta_data->>'linkedin_profile', NEW.raw_user_meta_data->>'linkedinProfile', '');
  v_phone_number := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phoneNumber', '');
  v_job_title := COALESCE(NEW.raw_user_meta_data->>'job_title', NEW.raw_user_meta_data->>'jobTitle', '');
  
  -- String fields
  v_ideal_target_description := COALESCE(NEW.raw_user_meta_data->>'ideal_target_description', NEW.raw_user_meta_data->>'idealTargetDescription', '');
  v_revenue_range_min := COALESCE(NEW.raw_user_meta_data->>'revenue_range_min', NEW.raw_user_meta_data->>'revenueRangeMin', '');
  v_revenue_range_max := COALESCE(NEW.raw_user_meta_data->>'revenue_range_max', NEW.raw_user_meta_data->>'revenueRangeMax', '');
  v_specific_business_search := COALESCE(NEW.raw_user_meta_data->>'specific_business_search', NEW.raw_user_meta_data->>'specificBusinessSearch', '');
  v_estimated_revenue := COALESCE(NEW.raw_user_meta_data->>'estimated_revenue', NEW.raw_user_meta_data->>'estimatedRevenue', '');
  v_fund_size := COALESCE(NEW.raw_user_meta_data->>'fund_size', NEW.raw_user_meta_data->>'fundSize', '');
  v_aum := COALESCE(NEW.raw_user_meta_data->>'aum', '');
  v_is_funded := COALESCE(NEW.raw_user_meta_data->>'is_funded', NEW.raw_user_meta_data->>'isFunded', '');
  v_funded_by := COALESCE(NEW.raw_user_meta_data->>'funded_by', NEW.raw_user_meta_data->>'fundedBy', '');
  v_target_company_size := COALESCE(NEW.raw_user_meta_data->>'target_company_size', NEW.raw_user_meta_data->>'targetCompanySize', '');
  v_funding_source := COALESCE(NEW.raw_user_meta_data->>'funding_source', NEW.raw_user_meta_data->>'fundingSource', '');
  v_needs_loan := COALESCE(NEW.raw_user_meta_data->>'needs_loan', NEW.raw_user_meta_data->>'needsLoan', '');
  v_ideal_target := COALESCE(NEW.raw_user_meta_data->>'ideal_target', NEW.raw_user_meta_data->>'idealTarget', '');
  v_deploying_capital_now := COALESCE(NEW.raw_user_meta_data->>'deploying_capital_now', NEW.raw_user_meta_data->>'deployingCapitalNow', '');
  v_owning_business_unit := COALESCE(NEW.raw_user_meta_data->>'owning_business_unit', NEW.raw_user_meta_data->>'owningBusinessUnit', '');
  v_deal_size_band := COALESCE(NEW.raw_user_meta_data->>'deal_size_band', NEW.raw_user_meta_data->>'dealSizeBand', '');
  v_corpdev_intent := COALESCE(NEW.raw_user_meta_data->>'corpdev_intent', NEW.raw_user_meta_data->>'corpdevIntent', '');
  v_discretion_type := COALESCE(NEW.raw_user_meta_data->>'discretion_type', NEW.raw_user_meta_data->>'discretionType', '');
  v_committed_equity_band := COALESCE(NEW.raw_user_meta_data->>'committed_equity_band', NEW.raw_user_meta_data->>'committedEquityBand', '');
  v_deployment_timing := COALESCE(NEW.raw_user_meta_data->>'deployment_timing', NEW.raw_user_meta_data->>'deploymentTiming', '');
  v_deal_structure_preference := COALESCE(NEW.raw_user_meta_data->>'deal_structure_preference', NEW.raw_user_meta_data->>'dealStructurePreference', '');
  v_search_type := COALESCE(NEW.raw_user_meta_data->>'search_type', NEW.raw_user_meta_data->>'searchType', '');
  v_acq_equity_band := COALESCE(NEW.raw_user_meta_data->>'acq_equity_band', NEW.raw_user_meta_data->>'acqEquityBand', '');
  v_search_stage := COALESCE(NEW.raw_user_meta_data->>'search_stage', NEW.raw_user_meta_data->>'searchStage', '');
  v_on_behalf_of_buyer := COALESCE(NEW.raw_user_meta_data->>'on_behalf_of_buyer', NEW.raw_user_meta_data->>'onBehalfOfBuyer', '');
  v_buyer_role := COALESCE(NEW.raw_user_meta_data->>'buyer_role', NEW.raw_user_meta_data->>'buyerRole', '');
  v_buyer_org_url := COALESCE(NEW.raw_user_meta_data->>'buyer_org_url', NEW.raw_user_meta_data->>'buyerOrgUrl', '');
  v_owner_timeline := COALESCE(NEW.raw_user_meta_data->>'owner_timeline', NEW.raw_user_meta_data->>'ownerTimeline', '');
  v_owner_intent := COALESCE(NEW.raw_user_meta_data->>'owner_intent', NEW.raw_user_meta_data->>'ownerIntent', '');
  v_uses_bank_finance := COALESCE(NEW.raw_user_meta_data->>'uses_bank_finance', NEW.raw_user_meta_data->>'usesBankFinance', '');
  v_max_equity_today_band := COALESCE(NEW.raw_user_meta_data->>'max_equity_today_band', NEW.raw_user_meta_data->>'maxEquityTodayBand', '');
  v_mandate_blurb := COALESCE(NEW.raw_user_meta_data->>'mandate_blurb', NEW.raw_user_meta_data->>'mandateBlurb', '');
  v_portfolio_company_addon := COALESCE(NEW.raw_user_meta_data->>'portfolio_company_addon', NEW.raw_user_meta_data->>'portfolioCompanyAddon', '');
  v_backers_summary := COALESCE(NEW.raw_user_meta_data->>'backers_summary', NEW.raw_user_meta_data->>'backersSummary', '');
  v_anchor_investors_summary := COALESCE(NEW.raw_user_meta_data->>'anchor_investors_summary', NEW.raw_user_meta_data->>'anchorInvestorsSummary', '');
  v_deal_intent := COALESCE(NEW.raw_user_meta_data->>'deal_intent', NEW.raw_user_meta_data->>'dealIntent', '');
  
  -- Step 3 fields
  v_referral_source := COALESCE(NEW.raw_user_meta_data->>'referral_source', NEW.raw_user_meta_data->>'referralSource', NULL);
  v_referral_source_detail := COALESCE(NEW.raw_user_meta_data->>'referral_source_detail', NEW.raw_user_meta_data->>'referralSourceDetail', NULL);
  v_target_acquisition_volume := COALESCE(NEW.raw_user_meta_data->>'target_acquisition_volume', NEW.raw_user_meta_data->>'targetAcquisitionVolume', NULL);

  -- Handle bigint fields
  BEGIN
    v_target_deal_size_min := (NEW.raw_user_meta_data->>'target_deal_size_min')::bigint;
  EXCEPTION WHEN others THEN
    BEGIN
      v_target_deal_size_min := (NEW.raw_user_meta_data->>'targetDealSizeMin')::bigint;
    EXCEPTION WHEN others THEN
      v_target_deal_size_min := NULL;
    END;
  END;

  BEGIN
    v_target_deal_size_max := (NEW.raw_user_meta_data->>'target_deal_size_max')::bigint;
  EXCEPTION WHEN others THEN
    BEGIN
      v_target_deal_size_max := (NEW.raw_user_meta_data->>'targetDealSizeMax')::bigint;
    EXCEPTION WHEN others THEN
      v_target_deal_size_max := NULL;
    END;
  END;

  -- Handle boolean fields
  BEGIN
    v_permanent_capital := COALESCE((NEW.raw_user_meta_data->>'permanent_capital')::boolean, (NEW.raw_user_meta_data->>'permanentCapital')::boolean, NULL);
  EXCEPTION WHEN others THEN
    v_permanent_capital := NULL;
  END;

  BEGIN
    v_flex_subxm_ebitda := COALESCE((NEW.raw_user_meta_data->>'flex_subxm_ebitda')::boolean, (NEW.raw_user_meta_data->>'flexSubxmEbitda')::boolean, NULL);
  EXCEPTION WHEN others THEN
    v_flex_subxm_ebitda := NULL;
  END;

  BEGIN
    v_flex_sub2m_ebitda := COALESCE((NEW.raw_user_meta_data->>'flex_sub2m_ebitda')::boolean, (NEW.raw_user_meta_data->>'flexSub2mEbitda')::boolean, NULL);
  EXCEPTION WHEN others THEN
    v_flex_sub2m_ebitda := NULL;
  END;

  -- Handle array fields safely with proper exception handling
  BEGIN
    IF NEW.raw_user_meta_data->'business_categories' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'business_categories') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_business_categories FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'business_categories') AS elem;
    ELSIF NEW.raw_user_meta_data->'businessCategories' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'businessCategories') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_business_categories FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'businessCategories') AS elem;
    ELSE
      v_business_categories := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_business_categories := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'target_locations' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'target_locations') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_target_locations FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'target_locations') AS elem;
    ELSIF NEW.raw_user_meta_data->'targetLocations' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'targetLocations') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_target_locations FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'targetLocations') AS elem;
    ELSE
      v_target_locations := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_target_locations := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'investment_size' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'investment_size') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_investment_size FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'investment_size') AS elem;
    ELSIF NEW.raw_user_meta_data->'investmentSize' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'investmentSize') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_investment_size FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'investmentSize') AS elem;
    ELSE
      v_investment_size := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_investment_size := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'geographic_focus' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'geographic_focus') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_geographic_focus FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'geographic_focus') AS elem;
    ELSIF NEW.raw_user_meta_data->'geographicFocus' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'geographicFocus') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_geographic_focus FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'geographicFocus') AS elem;
    ELSE
      v_geographic_focus := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_geographic_focus := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'industry_expertise' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'industry_expertise') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_industry_expertise FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'industry_expertise') AS elem;
    ELSIF NEW.raw_user_meta_data->'industryExpertise' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'industryExpertise') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_industry_expertise FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'industryExpertise') AS elem;
    ELSE
      v_industry_expertise := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_industry_expertise := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'integration_plan' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'integration_plan') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_integration_plan FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'integration_plan') AS elem;
    ELSIF NEW.raw_user_meta_data->'integrationPlan' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'integrationPlan') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_integration_plan FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'integrationPlan') AS elem;
    ELSE
      v_integration_plan := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_integration_plan := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'equity_source' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'equity_source') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_equity_source FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'equity_source') AS elem;
    ELSIF NEW.raw_user_meta_data->'equitySource' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'equitySource') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_equity_source FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'equitySource') AS elem;
    ELSE
      v_equity_source := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_equity_source := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'financing_plan' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'financing_plan') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_financing_plan FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'financing_plan') AS elem;
    ELSIF NEW.raw_user_meta_data->'financingPlan' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'financingPlan') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_financing_plan FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'financingPlan') AS elem;
    ELSE
      v_financing_plan := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_financing_plan := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'operating_company_targets' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'operating_company_targets') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_operating_company_targets FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'operating_company_targets') AS elem;
    ELSIF NEW.raw_user_meta_data->'operatingCompanyTargets' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'operatingCompanyTargets') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_operating_company_targets FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'operatingCompanyTargets') AS elem;
    ELSE
      v_operating_company_targets := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_operating_company_targets := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'exclusions' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'exclusions') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_exclusions FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'exclusions') AS elem;
    ELSE
      v_exclusions := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_exclusions := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'include_keywords' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'include_keywords') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_include_keywords FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'include_keywords') AS elem;
    ELSIF NEW.raw_user_meta_data->'includeKeywords' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'includeKeywords') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_include_keywords FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'includeKeywords') AS elem;
    ELSE
      v_include_keywords := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_include_keywords := ARRAY[]::text[];
  END;

  BEGIN
    IF NEW.raw_user_meta_data->'deal_sourcing_methods' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'deal_sourcing_methods') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_deal_sourcing_methods FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'deal_sourcing_methods') AS elem;
    ELSIF NEW.raw_user_meta_data->'dealSourcingMethods' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'dealSourcingMethods') = 'array' THEN
      SELECT array_agg(elem::text) INTO v_deal_sourcing_methods FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'dealSourcingMethods') AS elem;
    ELSE
      v_deal_sourcing_methods := ARRAY[]::text[];
    END IF;
  EXCEPTION WHEN others THEN
    v_deal_sourcing_methods := ARRAY[]::text[];
  END;

  -- Insert or update profile using ON CONFLICT DO UPDATE
  -- CRITICAL FIX: Cast text[] arrays to jsonb for jsonb columns
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    company,
    buyer_type,
    website,
    linkedin_profile,
    phone_number,
    job_title,
    business_categories,
    target_locations,
    investment_size,
    geographic_focus,
    industry_expertise,
    ideal_target_description,
    revenue_range_min,
    revenue_range_max,
    specific_business_search,
    estimated_revenue,
    fund_size,
    aum,
    is_funded,
    funded_by,
    target_company_size,
    funding_source,
    needs_loan,
    ideal_target,
    deploying_capital_now,
    owning_business_unit,
    deal_size_band,
    integration_plan,
    corpdev_intent,
    discretion_type,
    committed_equity_band,
    equity_source,
    deployment_timing,
    target_deal_size_min,
    target_deal_size_max,
    deal_structure_preference,
    permanent_capital,
    operating_company_targets,
    flex_subxm_ebitda,
    search_type,
    acq_equity_band,
    financing_plan,
    search_stage,
    flex_sub2m_ebitda,
    on_behalf_of_buyer,
    buyer_role,
    buyer_org_url,
    owner_timeline,
    owner_intent,
    uses_bank_finance,
    max_equity_today_band,
    mandate_blurb,
    portfolio_company_addon,
    backers_summary,
    anchor_investors_summary,
    deal_intent,
    exclusions,
    include_keywords,
    referral_source,
    referral_source_detail,
    deal_sourcing_methods,
    target_acquisition_volume,
    approval_status,
    email_verified
  ) VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_company,
    v_buyer_type,
    v_website,
    v_linkedin_profile,
    v_phone_number,
    v_job_title,
    to_jsonb(COALESCE(v_business_categories, ARRAY[]::text[])),
    to_jsonb(COALESCE(v_target_locations, ARRAY[]::text[])),
    to_jsonb(COALESCE(v_investment_size, ARRAY[]::text[])),
    to_jsonb(COALESCE(v_geographic_focus, ARRAY[]::text[])),
    to_jsonb(COALESCE(v_industry_expertise, ARRAY[]::text[])),
    v_ideal_target_description,
    v_revenue_range_min,
    v_revenue_range_max,
    v_specific_business_search,
    v_estimated_revenue,
    v_fund_size,
    v_aum,
    v_is_funded,
    v_funded_by,
    v_target_company_size,
    v_funding_source,
    v_needs_loan,
    v_ideal_target,
    v_deploying_capital_now,
    v_owning_business_unit,
    v_deal_size_band,
    to_jsonb(COALESCE(v_integration_plan, ARRAY[]::text[])),
    v_corpdev_intent,
    v_discretion_type,
    v_committed_equity_band,
    to_jsonb(COALESCE(v_equity_source, ARRAY[]::text[])),
    v_deployment_timing,
    v_target_deal_size_min,
    v_target_deal_size_max,
    v_deal_structure_preference,
    v_permanent_capital,
    to_jsonb(COALESCE(v_operating_company_targets, ARRAY[]::text[])),
    v_flex_subxm_ebitda,
    v_search_type,
    v_acq_equity_band,
    to_jsonb(COALESCE(v_financing_plan, ARRAY[]::text[])),
    v_search_stage,
    v_flex_sub2m_ebitda,
    v_on_behalf_of_buyer,
    v_buyer_role,
    v_buyer_org_url,
    v_owner_timeline,
    v_owner_intent,
    v_uses_bank_finance,
    v_max_equity_today_band,
    v_mandate_blurb,
    v_portfolio_company_addon,
    v_backers_summary,
    v_anchor_investors_summary,
    v_deal_intent,
    to_jsonb(COALESCE(v_exclusions, ARRAY[]::text[])),
    to_jsonb(COALESCE(v_include_keywords, ARRAY[]::text[])),
    v_referral_source,
    v_referral_source_detail,
    to_jsonb(COALESCE(v_deal_sourcing_methods, ARRAY[]::text[])),
    v_target_acquisition_volume,
    'pending',
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), profiles.last_name),
    company = COALESCE(NULLIF(EXCLUDED.company, ''), profiles.company),
    buyer_type = COALESCE(NULLIF(EXCLUDED.buyer_type, ''), profiles.buyer_type),
    website = COALESCE(NULLIF(EXCLUDED.website, ''), profiles.website),
    linkedin_profile = COALESCE(NULLIF(EXCLUDED.linkedin_profile, ''), profiles.linkedin_profile),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number, ''), profiles.phone_number),
    job_title = COALESCE(NULLIF(EXCLUDED.job_title, ''), profiles.job_title),
    business_categories = CASE WHEN jsonb_array_length(EXCLUDED.business_categories) > 0 THEN EXCLUDED.business_categories ELSE profiles.business_categories END,
    target_locations = CASE WHEN jsonb_array_length(EXCLUDED.target_locations) > 0 THEN EXCLUDED.target_locations ELSE profiles.target_locations END,
    investment_size = CASE WHEN jsonb_array_length(EXCLUDED.investment_size) > 0 THEN EXCLUDED.investment_size ELSE profiles.investment_size END,
    geographic_focus = CASE WHEN jsonb_array_length(EXCLUDED.geographic_focus) > 0 THEN EXCLUDED.geographic_focus ELSE profiles.geographic_focus END,
    industry_expertise = CASE WHEN jsonb_array_length(EXCLUDED.industry_expertise) > 0 THEN EXCLUDED.industry_expertise ELSE profiles.industry_expertise END,
    ideal_target_description = COALESCE(NULLIF(EXCLUDED.ideal_target_description, ''), profiles.ideal_target_description),
    revenue_range_min = COALESCE(NULLIF(EXCLUDED.revenue_range_min, ''), profiles.revenue_range_min),
    revenue_range_max = COALESCE(NULLIF(EXCLUDED.revenue_range_max, ''), profiles.revenue_range_max),
    specific_business_search = COALESCE(NULLIF(EXCLUDED.specific_business_search, ''), profiles.specific_business_search),
    estimated_revenue = COALESCE(NULLIF(EXCLUDED.estimated_revenue, ''), profiles.estimated_revenue),
    fund_size = COALESCE(NULLIF(EXCLUDED.fund_size, ''), profiles.fund_size),
    aum = COALESCE(NULLIF(EXCLUDED.aum, ''), profiles.aum),
    is_funded = COALESCE(NULLIF(EXCLUDED.is_funded, ''), profiles.is_funded),
    funded_by = COALESCE(NULLIF(EXCLUDED.funded_by, ''), profiles.funded_by),
    target_company_size = COALESCE(NULLIF(EXCLUDED.target_company_size, ''), profiles.target_company_size),
    funding_source = COALESCE(NULLIF(EXCLUDED.funding_source, ''), profiles.funding_source),
    needs_loan = COALESCE(NULLIF(EXCLUDED.needs_loan, ''), profiles.needs_loan),
    ideal_target = COALESCE(NULLIF(EXCLUDED.ideal_target, ''), profiles.ideal_target),
    deploying_capital_now = COALESCE(NULLIF(EXCLUDED.deploying_capital_now, ''), profiles.deploying_capital_now),
    owning_business_unit = COALESCE(NULLIF(EXCLUDED.owning_business_unit, ''), profiles.owning_business_unit),
    deal_size_band = COALESCE(NULLIF(EXCLUDED.deal_size_band, ''), profiles.deal_size_band),
    integration_plan = CASE WHEN jsonb_array_length(EXCLUDED.integration_plan) > 0 THEN EXCLUDED.integration_plan ELSE profiles.integration_plan END,
    corpdev_intent = COALESCE(NULLIF(EXCLUDED.corpdev_intent, ''), profiles.corpdev_intent),
    discretion_type = COALESCE(NULLIF(EXCLUDED.discretion_type, ''), profiles.discretion_type),
    committed_equity_band = COALESCE(NULLIF(EXCLUDED.committed_equity_band, ''), profiles.committed_equity_band),
    equity_source = CASE WHEN jsonb_array_length(EXCLUDED.equity_source) > 0 THEN EXCLUDED.equity_source ELSE profiles.equity_source END,
    deployment_timing = COALESCE(NULLIF(EXCLUDED.deployment_timing, ''), profiles.deployment_timing),
    target_deal_size_min = COALESCE(EXCLUDED.target_deal_size_min, profiles.target_deal_size_min),
    target_deal_size_max = COALESCE(EXCLUDED.target_deal_size_max, profiles.target_deal_size_max),
    deal_structure_preference = COALESCE(NULLIF(EXCLUDED.deal_structure_preference, ''), profiles.deal_structure_preference),
    permanent_capital = COALESCE(EXCLUDED.permanent_capital, profiles.permanent_capital),
    operating_company_targets = CASE WHEN jsonb_array_length(EXCLUDED.operating_company_targets) > 0 THEN EXCLUDED.operating_company_targets ELSE profiles.operating_company_targets END,
    flex_subxm_ebitda = COALESCE(EXCLUDED.flex_subxm_ebitda, profiles.flex_subxm_ebitda),
    search_type = COALESCE(NULLIF(EXCLUDED.search_type, ''), profiles.search_type),
    acq_equity_band = COALESCE(NULLIF(EXCLUDED.acq_equity_band, ''), profiles.acq_equity_band),
    financing_plan = CASE WHEN jsonb_array_length(EXCLUDED.financing_plan) > 0 THEN EXCLUDED.financing_plan ELSE profiles.financing_plan END,
    search_stage = COALESCE(NULLIF(EXCLUDED.search_stage, ''), profiles.search_stage),
    flex_sub2m_ebitda = COALESCE(EXCLUDED.flex_sub2m_ebitda, profiles.flex_sub2m_ebitda),
    on_behalf_of_buyer = COALESCE(NULLIF(EXCLUDED.on_behalf_of_buyer, ''), profiles.on_behalf_of_buyer),
    buyer_role = COALESCE(NULLIF(EXCLUDED.buyer_role, ''), profiles.buyer_role),
    buyer_org_url = COALESCE(NULLIF(EXCLUDED.buyer_org_url, ''), profiles.buyer_org_url),
    owner_timeline = COALESCE(NULLIF(EXCLUDED.owner_timeline, ''), profiles.owner_timeline),
    owner_intent = COALESCE(NULLIF(EXCLUDED.owner_intent, ''), profiles.owner_intent),
    uses_bank_finance = COALESCE(NULLIF(EXCLUDED.uses_bank_finance, ''), profiles.uses_bank_finance),
    max_equity_today_band = COALESCE(NULLIF(EXCLUDED.max_equity_today_band, ''), profiles.max_equity_today_band),
    mandate_blurb = COALESCE(NULLIF(EXCLUDED.mandate_blurb, ''), profiles.mandate_blurb),
    portfolio_company_addon = COALESCE(NULLIF(EXCLUDED.portfolio_company_addon, ''), profiles.portfolio_company_addon),
    backers_summary = COALESCE(NULLIF(EXCLUDED.backers_summary, ''), profiles.backers_summary),
    anchor_investors_summary = COALESCE(NULLIF(EXCLUDED.anchor_investors_summary, ''), profiles.anchor_investors_summary),
    deal_intent = COALESCE(NULLIF(EXCLUDED.deal_intent, ''), profiles.deal_intent),
    exclusions = CASE WHEN jsonb_array_length(EXCLUDED.exclusions) > 0 THEN EXCLUDED.exclusions ELSE profiles.exclusions END,
    include_keywords = CASE WHEN jsonb_array_length(EXCLUDED.include_keywords) > 0 THEN EXCLUDED.include_keywords ELSE profiles.include_keywords END,
    referral_source = COALESCE(EXCLUDED.referral_source, profiles.referral_source),
    referral_source_detail = COALESCE(EXCLUDED.referral_source_detail, profiles.referral_source_detail),
    deal_sourcing_methods = CASE WHEN jsonb_array_length(EXCLUDED.deal_sourcing_methods) > 0 THEN EXCLUDED.deal_sourcing_methods ELSE profiles.deal_sourcing_methods END,
    target_acquisition_volume = COALESCE(EXCLUDED.target_acquisition_volume, profiles.target_acquisition_volume),
    email_verified = CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE profiles.email_verified END,
    updated_at = now();

  -- Log successful trigger execution
  INSERT INTO public.trigger_logs (user_id, user_email, trigger_name, status)
  VALUES (NEW.id, NEW.email, 'handle_new_user', 'success');

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Log failed trigger execution with error details
  INSERT INTO public.trigger_logs (user_id, user_email, trigger_name, status, error_message, metadata)
  VALUES (NEW.id, NEW.email, 'handle_new_user', 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  
  -- Re-raise the exception so the auth signup still fails visibly
  -- Actually, we should NOT re-raise - let auth complete, profile will be synced later
  RETURN NEW;
END;
$function$;
