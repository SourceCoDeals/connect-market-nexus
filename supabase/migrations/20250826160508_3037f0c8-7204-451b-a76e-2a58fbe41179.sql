-- Create or replace handle_new_user to map ALL signup metadata into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  raw jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  -- helper getters
  v_first_name text := COALESCE(raw->>'first_name', raw->>'firstName', '');
  v_last_name  text := COALESCE(raw->>'last_name', raw->>'lastName', '');
  v_website    text := COALESCE(raw->>'website', '');
  v_linkedin   text := COALESCE(raw->>'linkedin_profile', raw->>'linkedinProfile', '');
  v_phone      text := COALESCE(raw->>'phone_number', raw->>'phoneNumber', NULL);
  v_buyer_type text := NULLIF(COALESCE(raw->>'buyer_type', raw->>'buyerType', ''), '');
  -- arrays (jsonb)
  v_business_categories jsonb := COALESCE(NULLIF(raw->'business_categories','null'::jsonb), raw->'businessCategories', '[]'::jsonb);
  v_target_locations    jsonb := COALESCE(NULLIF(raw->'target_locations','null'::jsonb), raw->'targetLocations', '[]'::jsonb);
  v_investment_size     jsonb := COALESCE(NULLIF(raw->'investment_size','null'::jsonb), raw->'investmentSize', '[]'::jsonb);
  v_industry_expertise  jsonb := COALESCE(NULLIF(raw->'industry_expertise','null'::jsonb), raw->'industryExpertise', NULL);
  v_geographic_focus    jsonb := COALESCE(NULLIF(raw->'geographic_focus','null'::jsonb), raw->'geographicFocus', NULL);
  v_equity_source       jsonb := COALESCE(NULLIF(raw->'equity_source','null'::jsonb), raw->'equitySource', '[]'::jsonb);
  v_financing_plan      jsonb := COALESCE(NULLIF(raw->'financing_plan','null'::jsonb), raw->'financingPlan', '[]'::jsonb);
  v_operating_company_targets jsonb := COALESCE(NULLIF(raw->'operating_company_targets','null'::jsonb), raw->'operatingCompanyTargets', '[]'::jsonb);
  v_integration_plan    jsonb := COALESCE(NULLIF(raw->'integration_plan','null'::jsonb), raw->'integrationPlan', '[]'::jsonb);
  v_exclusions          jsonb := COALESCE(NULLIF(raw->'exclusions','null'::jsonb), '[]'::jsonb);
  v_include_keywords    jsonb := COALESCE(NULLIF(raw->'include_keywords','null'::jsonb), raw->'includeKeywords', '[]'::jsonb);
  v_investment_size_alt jsonb := COALESCE(NULLIF(raw->'investment_size','null'::jsonb), raw->'investmentSize', '[]'::jsonb);
  -- booleans
  v_permanent_capital boolean := CASE
    WHEN raw ? 'permanent_capital' THEN (raw->>'permanent_capital')::boolean
    WHEN raw ? 'permanentCapital' THEN (raw->>'permanentCapital')::boolean
    ELSE NULL
  END;
  v_flex_subxm_ebitda boolean := CASE
    WHEN raw ? 'flex_subxm_ebitda' THEN (raw->>'flex_subxm_ebitda')::boolean
    WHEN raw ? 'flexSubXmEbitda' THEN (raw->>'flexSubXmEbitda')::boolean
    ELSE NULL
  END;
  v_flex_sub2m_ebitda boolean := CASE
    WHEN raw ? 'flex_sub2m_ebitda' THEN (raw->>'flex_sub2m_ebitda')::boolean
    WHEN raw ? 'flexSub2mEbitda' THEN (raw->>'flexSub2mEbitda')::boolean
    ELSE NULL
  END;
  -- numerics
  v_target_deal_size_min numeric := NULLIF(COALESCE(raw->>'target_deal_size_min', raw->>'targetDealSizeMin', ''), '')::numeric;
  v_target_deal_size_max numeric := NULLIF(COALESCE(raw->>'target_deal_size_max', raw->>'targetDealSizeMax', ''), '')::numeric;
  -- general texts
  v_company text := COALESCE(raw->>'company', NULL);
  v_bio text := COALESCE(raw->>'bio', NULL);
  v_deal_intent text := COALESCE(raw->>'deal_intent', raw->>'dealIntent', NULL);
  v_revenue_range_min text := COALESCE(raw->>'revenue_range_min', raw->>'revenueRangeMin', NULL);
  v_revenue_range_max text := COALESCE(raw->>'revenue_range_max', raw->>'revenueRangeMax', NULL);
  v_specific_business_search text := COALESCE(raw->>'specific_business_search', raw->>'specificBusinessSearch', NULL);
  -- PE / Corporate / FO / IS / SF / Advisor / Owner / Individual fields (texts)
  v_job_title text := COALESCE(raw->>'job_title', raw->>'jobTitle', NULL);
  v_portfolio_company_addon text := COALESCE(raw->>'portfolio_company_addon', raw->>'portfolioCompanyAddon', NULL);
  v_deploying_capital_now text := COALESCE(raw->>'deploying_capital_now', raw->>'deployingCapitalNow', NULL);
  v_owning_business_unit text := COALESCE(raw->>'owning_business_unit', raw->>'owningBusinessUnit', NULL);
  v_deal_size_band text := COALESCE(raw->>'deal_size_band', raw->>'dealSizeBand', NULL);
  v_corpdev_intent text := COALESCE(raw->>'corpdev_intent', raw->>'corpDevIntent', NULL);
  v_discretion_type text := COALESCE(raw->>'discretion_type', raw->>'discretionType', NULL);
  v_committed_equity_band text := COALESCE(raw->>'committed_equity_band', raw->>'committedEquityBand', NULL);
  v_backers_summary text := COALESCE(raw->>'backers_summary', raw->>'backersSummary', NULL);
  v_deployment_timing text := COALESCE(raw->>'deployment_timing', raw->>'deploymentTiming', NULL);
  v_search_type text := COALESCE(raw->>'search_type', raw->>'searchType', NULL);
  v_acq_equity_band text := COALESCE(raw->>'acq_equity_band', raw->>'acqEquityBand', NULL);
  v_anchor_investors_summary text := COALESCE(raw->>'anchor_investors_summary', raw->>'anchorInvestorsSummary', NULL);
  v_search_stage text := COALESCE(raw->>'search_stage', raw->>'searchStage', NULL);
  v_on_behalf_of_buyer text := COALESCE(raw->>'on_behalf_of_buyer', raw->>'onBehalfOfBuyer', NULL);
  v_buyer_role text := COALESCE(raw->>'buyer_role', raw->>'buyerRole', NULL);
  v_buyer_org_url text := COALESCE(raw->>'buyer_org_url', raw->>'buyerOrgUrl', NULL);
  v_mandate_blurb text := COALESCE(raw->>'mandate_blurb', raw->>'mandateBlurb', NULL);
  v_owner_intent text := COALESCE(raw->>'owner_intent', raw->>'ownerIntent', NULL);
  v_owner_timeline text := COALESCE(raw->>'owner_timeline', raw->>'ownerTimeline', NULL);
  v_max_equity_today_band text := COALESCE(raw->>'max_equity_today_band', raw->>'maxEquityTodayBand', NULL);
  v_uses_bank_finance text := COALESCE(raw->>'uses_bank_finance', raw->>'usesBankFinance', NULL);
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    website,
    linkedin_profile,
    phone_number,
    buyer_type,
    approval_status,
    business_categories,
    target_locations,
    investment_size,
    industry_expertise,
    geographic_focus,
    equity_source,
    financing_plan,
    operating_company_targets,
    integration_plan,
    exclusions,
    include_keywords,
    permanent_capital,
    flex_subxm_ebitda,
    flex_sub2m_ebitda,
    target_deal_size_min,
    target_deal_size_max,
    company,
    bio,
    deal_intent,
    revenue_range_min,
    revenue_range_max,
    specific_business_search,
    job_title,
    portfolio_company_addon,
    deploying_capital_now,
    owning_business_unit,
    deal_size_band,
    corpdev_intent,
    discretion_type,
    committed_equity_band,
    backers_summary,
    deployment_timing,
    search_type,
    acq_equity_band,
    anchor_investors_summary,
    search_stage,
    on_behalf_of_buyer,
    buyer_role,
    buyer_org_url,
    mandate_blurb,
    max_equity_today_band,
    uses_bank_finance
  ) VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_website,
    v_linkedin,
    v_phone,
    v_buyer_type,
    'pending',
    v_business_categories,
    v_target_locations,
    v_investment_size_alt,
    v_industry_expertise,
    v_geographic_focus,
    v_equity_source,
    v_financing_plan,
    v_operating_company_targets,
    v_integration_plan,
    v_exclusions,
    v_include_keywords,
    v_permanent_capital,
    v_flex_subxm_ebitda,
    v_flex_sub2m_ebitda,
    v_target_deal_size_min,
    v_target_deal_size_max,
    v_company,
    v_bio,
    v_deal_intent,
    v_revenue_range_min,
    v_revenue_range_max,
    v_specific_business_search,
    v_job_title,
    v_portfolio_company_addon,
    v_deploying_capital_now,
    v_owning_business_unit,
    v_deal_size_band,
    v_corpdev_intent,
    v_discretion_type,
    v_committed_equity_band,
    v_backers_summary,
    v_deployment_timing,
    v_search_type,
    v_acq_equity_band,
    v_anchor_investors_summary,
    v_search_stage,
    v_on_behalf_of_buyer,
    v_buyer_role,
    v_buyer_org_url,
    v_mandate_blurb,
    v_max_equity_today_band,
    v_uses_bank_finance
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    website = COALESCE(EXCLUDED.website, public.profiles.website),
    linkedin_profile = COALESCE(EXCLUDED.linkedin_profile, public.profiles.linkedin_profile),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    buyer_type = COALESCE(EXCLUDED.buyer_type, public.profiles.buyer_type),
    business_categories = COALESCE(NULLIF(EXCLUDED.business_categories, 'null'::jsonb), public.profiles.business_categories),
    target_locations = COALESCE(NULLIF(EXCLUDED.target_locations, 'null'::jsonb), public.profiles.target_locations),
    investment_size = COALESCE(NULLIF(EXCLUDED.investment_size, 'null'::jsonb), public.profiles.investment_size),
    industry_expertise = COALESCE(NULLIF(EXCLUDED.industry_expertise, 'null'::jsonb), public.profiles.industry_expertise),
    geographic_focus = COALESCE(NULLIF(EXCLUDED.geographic_focus, 'null'::jsonb), public.profiles.geographic_focus),
    equity_source = COALESCE(NULLIF(EXCLUDED.equity_source, 'null'::jsonb), public.profiles.equity_source),
    financing_plan = COALESCE(NULLIF(EXCLUDED.financing_plan, 'null'::jsonb), public.profiles.financing_plan),
    operating_company_targets = COALESCE(NULLIF(EXCLUDED.operating_company_targets, 'null'::jsonb), public.profiles.operating_company_targets),
    integration_plan = COALESCE(NULLIF(EXCLUDED.integration_plan, 'null'::jsonb), public.profiles.integration_plan),
    exclusions = COALESCE(NULLIF(EXCLUDED.exclusions, 'null'::jsonb), public.profiles.exclusions),
    include_keywords = COALESCE(NULLIF(EXCLUDED.include_keywords, 'null'::jsonb), public.profiles.include_keywords),
    permanent_capital = COALESCE(EXCLUDED.permanent_capital, public.profiles.permanent_capital),
    flex_subxm_ebitda = COALESCE(EXCLUDED.flex_subxm_ebitda, public.profiles.flex_subxm_ebitda),
    flex_sub2m_ebitda = COALESCE(EXCLUDED.flex_sub2m_ebitda, public.profiles.flex_sub2m_ebitda),
    target_deal_size_min = COALESCE(EXCLUDED.target_deal_size_min, public.profiles.target_deal_size_min),
    target_deal_size_max = COALESCE(EXCLUDED.target_deal_size_max, public.profiles.target_deal_size_max),
    company = COALESCE(EXCLUDED.company, public.profiles.company),
    bio = COALESCE(EXCLUDED.bio, public.profiles.bio),
    deal_intent = COALESCE(EXCLUDED.deal_intent, public.profiles.deal_intent),
    revenue_range_min = COALESCE(EXCLUDED.revenue_range_min, public.profiles.revenue_range_min),
    revenue_range_max = COALESCE(EXCLUDED.revenue_range_max, public.profiles.revenue_range_max),
    specific_business_search = COALESCE(EXCLUDED.specific_business_search, public.profiles.specific_business_search),
    job_title = COALESCE(EXCLUDED.job_title, public.profiles.job_title),
    portfolio_company_addon = COALESCE(EXCLUDED.portfolio_company_addon, public.profiles.portfolio_company_addon),
    deploying_capital_now = COALESCE(EXCLUDED.deploying_capital_now, public.profiles.deploying_capital_now),
    owning_business_unit = COALESCE(EXCLUDED.owning_business_unit, public.profiles.owning_business_unit),
    deal_size_band = COALESCE(EXCLUDED.deal_size_band, public.profiles.deal_size_band),
    corpdev_intent = COALESCE(EXCLUDED.corpdev_intent, public.profiles.corpdev_intent),
    discretion_type = COALESCE(EXCLUDED.discretion_type, public.profiles.discretion_type),
    committed_equity_band = COALESCE(EXCLUDED.committed_equity_band, public.profiles.committed_equity_band),
    backers_summary = COALESCE(EXCLUDED.backers_summary, public.profiles.backers_summary),
    deployment_timing = COALESCE(EXCLUDED.deployment_timing, public.profiles.deployment_timing),
    search_type = COALESCE(EXCLUDED.search_type, public.profiles.search_type),
    acq_equity_band = COALESCE(EXCLUDED.acq_equity_band, public.profiles.acq_equity_band),
    anchor_investors_summary = COALESCE(EXCLUDED.anchor_investors_summary, public.profiles.anchor_investors_summary),
    search_stage = COALESCE(EXCLUDED.search_stage, public.profiles.search_stage),
    on_behalf_of_buyer = COALESCE(EXCLUDED.on_behalf_of_buyer, public.profiles.on_behalf_of_buyer),
    buyer_role = COALESCE(EXCLUDED.buyer_role, public.profiles.buyer_role),
    buyer_org_url = COALESCE(EXCLUDED.buyer_org_url, public.profiles.buyer_org_url),
    mandate_blurb = COALESCE(EXCLUDED.mandate_blurb, public.profiles.mandate_blurb),
    max_equity_today_band = COALESCE(EXCLUDED.max_equity_today_band, public.profiles.max_equity_today_band),
    uses_bank_finance = COALESCE(EXCLUDED.uses_bank_finance, public.profiles.uses_bank_finance),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profiles'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profiles
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;
