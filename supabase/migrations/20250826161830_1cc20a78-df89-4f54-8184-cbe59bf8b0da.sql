-- Update handle_new_user to map ALL signup metadata fields comprehensively and backfill existing users

-- 1) Replace function with full mapping
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
  v_last_name  text := COALESCE(raw->>'last_name',  raw->>'lastName',  '');
  v_website    text := COALESCE(raw->>'website', '');
  v_linkedin   text := COALESCE(raw->>'linkedin_profile', raw->>'linkedinProfile', '');
  v_phone      text := NULLIF(COALESCE(raw->>'phone_number', raw->>'phoneNumber', ''), '');
  v_buyer_type text := NULLIF(COALESCE(raw->>'buyer_type', raw->>'buyerType', ''), '');
  v_job_title  text := NULLIF(COALESCE(raw->>'job_title', raw->>'jobTitle', ''), '');

  -- arrays (jsonb) with robust fallbacks
  v_business_categories jsonb := COALESCE(NULLIF(raw->'business_categories','null'::jsonb), raw->'businessCategories', '[]'::jsonb);
  v_target_locations    jsonb := COALESCE(NULLIF(raw->'target_locations','null'::jsonb),    raw->'targetLocations',    '[]'::jsonb);
  v_investment_size     jsonb := COALESCE(NULLIF(raw->'investment_size','null'::jsonb),     raw->'investmentSize',     '[]'::jsonb);
  v_industry_expertise  jsonb := COALESCE(NULLIF(raw->'industry_expertise','null'::jsonb),  raw->'industryExpertise',  '[]'::jsonb);
  v_geographic_focus    jsonb := COALESCE(NULLIF(raw->'geographic_focus','null'::jsonb),    raw->'geographicFocus',    '[]'::jsonb);
  v_equity_source       jsonb := COALESCE(NULLIF(raw->'equity_source','null'::jsonb),       raw->'equitySource',       '[]'::jsonb);
  v_financing_plan      jsonb := COALESCE(NULLIF(raw->'financing_plan','null'::jsonb),      raw->'financingPlan',      '[]'::jsonb);
  v_operating_company_targets jsonb := COALESCE(NULLIF(raw->'operating_company_targets','null'::jsonb), raw->'operatingCompanyTargets', '[]'::jsonb);
  v_integration_plan    jsonb := COALESCE(NULLIF(raw->'integration_plan','null'::jsonb),    raw->'integrationPlan',    '[]'::jsonb);
  v_exclusions          jsonb := COALESCE(NULLIF(raw->'exclusions','null'::jsonb),          raw->'hardExclusions',     '[]'::jsonb);
  v_include_keywords    jsonb := COALESCE(NULLIF(raw->'include_keywords','null'::jsonb),    raw->'includeKeywords',    raw->'keywords', '[]'::jsonb);

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
  v_company text := NULLIF(COALESCE(raw->>'company', NULL), '');
  v_company_name text := NULLIF(COALESCE(raw->>'company_name', raw->>'companyName', NULL), '');
  v_bio text := NULLIF(COALESCE(raw->>'bio', NULL), '');
  v_deal_intent text := NULLIF(COALESCE(raw->>'deal_intent', raw->>'dealIntent', NULL), '');
  v_revenue_range_min text := NULLIF(COALESCE(raw->>'revenue_range_min', raw->>'revenueRangeMin', NULL), '');
  v_revenue_range_max text := NULLIF(COALESCE(raw->>'revenue_range_max', raw->>'revenueRangeMax', NULL), '');
  v_specific_business_search text := NULLIF(COALESCE(raw->>'specific_business_search', raw->>'specificBusinessSearch', NULL), '');
  v_ideal_target text := NULLIF(COALESCE(raw->>'ideal_target', raw->>'idealTarget', NULL), '');
  v_ideal_target_description text := NULLIF(COALESCE(raw->>'ideal_target_description', raw->>'idealTargetDescription', NULL), '');
  v_deal_structure_preference text := NULLIF(COALESCE(raw->>'deal_structure_preference', raw->>'dealStructurePreference', NULL), '');

  -- PE / Corporate / FO / IS / SF / Advisor / Owner / Individual fields (texts)
  v_job_title_text text := v_job_title;
  v_portfolio_company_addon text := NULLIF(COALESCE(raw->>'portfolio_company_addon', raw->>'portfolioCompanyAddon', NULL), '');
  v_deploying_capital_now text := NULLIF(COALESCE(raw->>'deploying_capital_now', raw->>'deployingCapitalNow', NULL), '');
  v_owning_business_unit text := NULLIF(COALESCE(raw->>'owning_business_unit', raw->>'owningBusinessUnit', NULL), '');
  v_deal_size_band text := NULLIF(COALESCE(raw->>'deal_size_band', raw->>'dealSizeBand', NULL), '');
  v_corpdev_intent text := NULLIF(COALESCE(raw->>'corpdev_intent', raw->>'corpDevIntent', NULL), '');
  v_discretion_type text := NULLIF(COALESCE(raw->>'discretion_type', raw->>'discretionType', NULL), '');
  v_committed_equity_band text := NULLIF(COALESCE(raw->>'committed_equity_band', raw->>'committedEquityBand', NULL), '');
  v_backers_summary text := NULLIF(COALESCE(raw->>'backers_summary', raw->>'backersSummary', NULL), '');
  v_deployment_timing text := NULLIF(COALESCE(raw->>'deployment_timing', raw->>'deploymentTiming', NULL), '');
  v_search_type text := NULLIF(COALESCE(raw->>'search_type', raw->>'searchType', NULL), '');
  v_acq_equity_band text := NULLIF(COALESCE(raw->>'acq_equity_band', raw->>'acqEquityBand', NULL), '');
  v_anchor_investors_summary text := NULLIF(COALESCE(raw->>'anchor_investors_summary', raw->>'anchorInvestorsSummary', NULL), '');
  v_search_stage text := NULLIF(COALESCE(raw->>'search_stage', raw->>'searchStage', NULL), '');
  v_on_behalf_of_buyer text := NULLIF(COALESCE(raw->>'on_behalf_of_buyer', raw->>'onBehalfOfBuyer', NULL), '');
  v_buyer_role text := NULLIF(COALESCE(raw->>'buyer_role', raw->>'buyerRole', NULL), '');
  v_buyer_org_url text := NULLIF(COALESCE(raw->>'buyer_org_url', raw->>'buyerOrgUrl', NULL), '');
  v_mandate_blurb text := NULLIF(COALESCE(raw->>'mandate_blurb', raw->>'mandateBlurb', NULL), '');
  v_owner_intent text := NULLIF(COALESCE(raw->>'owner_intent', raw->>'ownerIntent', NULL), '');
  v_owner_timeline text := NULLIF(COALESCE(raw->>'owner_timeline', raw->>'ownerTimeline', NULL), '');
  v_max_equity_today_band text := NULLIF(COALESCE(raw->>'max_equity_today_band', raw->>'maxEquityTodayBand', NULL), '');
  v_uses_bank_finance text := NULLIF(COALESCE(raw->>'uses_bank_finance', raw->>'usesBankFinance', NULL), '');

  -- Additional PE/general numeric/text fields captured as text in schema
  v_estimated_revenue text := NULLIF(COALESCE(raw->>'estimated_revenue', raw->>'estimatedRevenue', NULL), '');
  v_fund_size text := NULLIF(COALESCE(raw->>'fund_size', raw->>'fundSize', NULL), '');
  v_aum text := NULLIF(COALESCE(raw->>'aum', raw->>'AUM', NULL), '');
  v_is_funded text := NULLIF(COALESCE(raw->>'is_funded', raw->>'isFunded', NULL), '');
  v_funded_by text := NULLIF(COALESCE(raw->>'funded_by', raw->>'fundedBy', NULL), '');
  v_target_company_size text := NULLIF(COALESCE(raw->>'target_company_size', raw->>'targetCompanySize', NULL), '');
  v_funding_source text := NULLIF(COALESCE(raw->>'funding_source', raw->>'fundingSource', NULL), '');
  v_needs_loan text := NULLIF(COALESCE(raw->>'needs_loan', raw->>'needsLoan', NULL), '');
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
    company_name,
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
    uses_bank_finance,
    ideal_target,
    ideal_target_description,
    deal_structure_preference,
    estimated_revenue,
    fund_size,
    aum,
    is_funded,
    funded_by,
    target_company_size,
    funding_source,
    needs_loan
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
    v_investment_size,
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
    v_company_name,
    v_bio,
    v_deal_intent,
    v_revenue_range_min,
    v_revenue_range_max,
    v_specific_business_search,
    v_job_title_text,
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
    v_uses_bank_finance,
    v_ideal_target,
    v_ideal_target_description,
    v_deal_structure_preference,
    v_estimated_revenue,
    v_fund_size,
    v_aum,
    v_is_funded,
    v_funded_by,
    v_target_company_size,
    v_funding_source,
    v_needs_loan
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name,''), public.profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name,''), public.profiles.last_name),
    website = COALESCE(NULLIF(EXCLUDED.website,''), public.profiles.website),
    linkedin_profile = COALESCE(NULLIF(EXCLUDED.linkedin_profile,''), public.profiles.linkedin_profile),
    phone_number = COALESCE(NULLIF(EXCLUDED.phone_number,''), public.profiles.phone_number),
    buyer_type = COALESCE(NULLIF(EXCLUDED.buyer_type,''), public.profiles.buyer_type),
    business_categories = CASE WHEN EXCLUDED.business_categories IS NOT NULL AND jsonb_array_length(EXCLUDED.business_categories) > 0 THEN EXCLUDED.business_categories ELSE public.profiles.business_categories END,
    target_locations = CASE WHEN EXCLUDED.target_locations IS NOT NULL AND jsonb_array_length(EXCLUDED.target_locations) > 0 THEN EXCLUDED.target_locations ELSE public.profiles.target_locations END,
    investment_size = CASE WHEN EXCLUDED.investment_size IS NOT NULL AND jsonb_array_length(EXCLUDED.investment_size) > 0 THEN EXCLUDED.investment_size ELSE public.profiles.investment_size END,
    industry_expertise = CASE WHEN EXCLUDED.industry_expertise IS NOT NULL AND jsonb_typeof(EXCLUDED.industry_expertise) = 'array' AND jsonb_array_length(EXCLUDED.industry_expertise) > 0 THEN EXCLUDED.industry_expertise ELSE public.profiles.industry_expertise END,
    geographic_focus = CASE WHEN EXCLUDED.geographic_focus IS NOT NULL AND jsonb_typeof(EXCLUDED.geographic_focus) = 'array' AND jsonb_array_length(EXCLUDED.geographic_focus) > 0 THEN EXCLUDED.geographic_focus ELSE public.profiles.geographic_focus END,
    equity_source = CASE WHEN EXCLUDED.equity_source IS NOT NULL AND jsonb_array_length(EXCLUDED.equity_source) > 0 THEN EXCLUDED.equity_source ELSE public.profiles.equity_source END,
    financing_plan = CASE WHEN EXCLUDED.financing_plan IS NOT NULL AND jsonb_array_length(EXCLUDED.financing_plan) > 0 THEN EXCLUDED.financing_plan ELSE public.profiles.financing_plan END,
    operating_company_targets = CASE WHEN EXCLUDED.operating_company_targets IS NOT NULL AND jsonb_array_length(EXCLUDED.operating_company_targets) > 0 THEN EXCLUDED.operating_company_targets ELSE public.profiles.operating_company_targets END,
    integration_plan = CASE WHEN EXCLUDED.integration_plan IS NOT NULL AND jsonb_array_length(EXCLUDED.integration_plan) > 0 THEN EXCLUDED.integration_plan ELSE public.profiles.integration_plan END,
    exclusions = CASE WHEN EXCLUDED.exclusions IS NOT NULL AND jsonb_array_length(EXCLUDED.exclusions) > 0 THEN EXCLUDED.exclusions ELSE public.profiles.exclusions END,
    include_keywords = CASE WHEN EXCLUDED.include_keywords IS NOT NULL AND jsonb_array_length(EXCLUDED.include_keywords) > 0 THEN EXCLUDED.include_keywords ELSE public.profiles.include_keywords END,
    permanent_capital = COALESCE(EXCLUDED.permanent_capital, public.profiles.permanent_capital),
    flex_subxm_ebitda = COALESCE(EXCLUDED.flex_subxm_ebitda, public.profiles.flex_subxm_ebitda),
    flex_sub2m_ebitda = COALESCE(EXCLUDED.flex_sub2m_ebitda, public.profiles.flex_sub2m_ebitda),
    target_deal_size_min = COALESCE(EXCLUDED.target_deal_size_min, public.profiles.target_deal_size_min),
    target_deal_size_max = COALESCE(EXCLUDED.target_deal_size_max, public.profiles.target_deal_size_max),
    company = COALESCE(NULLIF(EXCLUDED.company,''), public.profiles.company),
    company_name = COALESCE(NULLIF(EXCLUDED.company_name,''), public.profiles.company_name),
    bio = COALESCE(NULLIF(EXCLUDED.bio,''), public.profiles.bio),
    deal_intent = COALESCE(NULLIF(EXCLUDED.deal_intent,''), public.profiles.deal_intent),
    revenue_range_min = COALESCE(NULLIF(EXCLUDED.revenue_range_min,''), public.profiles.revenue_range_min),
    revenue_range_max = COALESCE(NULLIF(EXCLUDED.revenue_range_max,''), public.profiles.revenue_range_max),
    specific_business_search = COALESCE(NULLIF(EXCLUDED.specific_business_search,''), public.profiles.specific_business_search),
    job_title = COALESCE(NULLIF(EXCLUDED.job_title,''), public.profiles.job_title),
    portfolio_company_addon = COALESCE(NULLIF(EXCLUDED.portfolio_company_addon,''), public.profiles.portfolio_company_addon),
    deploying_capital_now = COALESCE(NULLIF(EXCLUDED.deploying_capital_now,''), public.profiles.deploying_capital_now),
    owning_business_unit = COALESCE(NULLIF(EXCLUDED.owning_business_unit,''), public.profiles.owning_business_unit),
    deal_size_band = COALESCE(NULLIF(EXCLUDED.deal_size_band,''), public.profiles.deal_size_band),
    corpdev_intent = COALESCE(NULLIF(EXCLUDED.corpdev_intent,''), public.profiles.corpdev_intent),
    discretion_type = COALESCE(NULLIF(EXCLUDED.discretion_type,''), public.profiles.discretion_type),
    committed_equity_band = COALESCE(NULLIF(EXCLUDED.committed_equity_band,''), public.profiles.committed_equity_band),
    backers_summary = COALESCE(NULLIF(EXCLUDED.backers_summary,''), public.profiles.backers_summary),
    deployment_timing = COALESCE(NULLIF(EXCLUDED.deployment_timing,''), public.profiles.deployment_timing),
    search_type = COALESCE(NULLIF(EXCLUDED.search_type,''), public.profiles.search_type),
    acq_equity_band = COALESCE(NULLIF(EXCLUDED.acq_equity_band,''), public.profiles.acq_equity_band),
    anchor_investors_summary = COALESCE(NULLIF(EXCLUDED.anchor_investors_summary,''), public.profiles.anchor_investors_summary),
    search_stage = COALESCE(NULLIF(EXCLUDED.search_stage,''), public.profiles.search_stage),
    on_behalf_of_buyer = COALESCE(NULLIF(EXCLUDED.on_behalf_of_buyer,''), public.profiles.on_behalf_of_buyer),
    buyer_role = COALESCE(NULLIF(EXCLUDED.buyer_role,''), public.profiles.buyer_role),
    buyer_org_url = COALESCE(NULLIF(EXCLUDED.buyer_org_url,''), public.profiles.buyer_org_url),
    mandate_blurb = COALESCE(NULLIF(EXCLUDED.mandate_blurb,''), public.profiles.mandate_blurb),
    max_equity_today_band = COALESCE(NULLIF(EXCLUDED.max_equity_today_band,''), public.profiles.max_equity_today_band),
    uses_bank_finance = COALESCE(NULLIF(EXCLUDED.uses_bank_finance,''), public.profiles.uses_bank_finance),
    ideal_target = COALESCE(NULLIF(EXCLUDED.ideal_target,''), public.profiles.ideal_target),
    ideal_target_description = COALESCE(NULLIF(EXCLUDED.ideal_target_description,''), public.profiles.ideal_target_description),
    deal_structure_preference = COALESCE(NULLIF(EXCLUDED.deal_structure_preference,''), public.profiles.deal_structure_preference),
    estimated_revenue = COALESCE(NULLIF(EXCLUDED.estimated_revenue,''), public.profiles.estimated_revenue),
    fund_size = COALESCE(NULLIF(EXCLUDED.fund_size,''), public.profiles.fund_size),
    aum = COALESCE(NULLIF(EXCLUDED.aum,''), public.profiles.aum),
    is_funded = COALESCE(NULLIF(EXCLUDED.is_funded,''), public.profiles.is_funded),
    funded_by = COALESCE(NULLIF(EXCLUDED.funded_by,''), public.profiles.funded_by),
    target_company_size = COALESCE(NULLIF(EXCLUDED.target_company_size,''), public.profiles.target_company_size),
    funding_source = COALESCE(NULLIF(EXCLUDED.funding_source,''), public.profiles.funding_source),
    needs_loan = COALESCE(NULLIF(EXCLUDED.needs_loan,''), public.profiles.needs_loan),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 2) Ensure trigger exists (idempotent)
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

-- 3) Backfill existing users' profiles from raw_user_meta_data safely
DO $$
DECLARE
  u RECORD;
  raw jsonb;
  -- reuse local vars for each user similar to function above
  v_first_name text; v_last_name text; v_website text; v_linkedin text; v_phone text; v_buyer_type text; v_job_title text;
  v_business_categories jsonb; v_target_locations jsonb; v_investment_size jsonb; v_industry_expertise jsonb; v_geographic_focus jsonb;
  v_equity_source jsonb; v_financing_plan jsonb; v_operating_company_targets jsonb; v_integration_plan jsonb; v_exclusions jsonb; v_include_keywords jsonb;
  v_permanent_capital boolean; v_flex_subxm_ebitda boolean; v_flex_sub2m_ebitda boolean;
  v_target_deal_size_min numeric; v_target_deal_size_max numeric;
  v_company text; v_company_name text; v_bio text; v_deal_intent text; v_revenue_range_min text; v_revenue_range_max text; v_specific_business_search text;
  v_ideal_target text; v_ideal_target_description text; v_deal_structure_preference text;
  v_portfolio_company_addon text; v_deploying_capital_now text; v_owning_business_unit text; v_deal_size_band text; v_corpdev_intent text; v_discretion_type text;
  v_committed_equity_band text; v_backers_summary text; v_deployment_timing text; v_search_type text; v_acq_equity_band text; v_anchor_investors_summary text; v_search_stage text;
  v_on_behalf_of_buyer text; v_buyer_role text; v_buyer_org_url text; v_mandate_blurb text; v_owner_intent text; v_owner_timeline text; v_max_equity_today_band text; v_uses_bank_finance text;
  v_estimated_revenue text; v_fund_size text; v_aum text; v_is_funded text; v_funded_by text; v_target_company_size text; v_funding_source text; v_needs_loan text;
BEGIN
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    raw := COALESCE(u.raw_user_meta_data, '{}'::jsonb);

    v_first_name := COALESCE(raw->>'first_name', raw->>'firstName', '');
    v_last_name  := COALESCE(raw->>'last_name',  raw->>'lastName',  '');
    v_website    := COALESCE(raw->>'website', '');
    v_linkedin   := COALESCE(raw->>'linkedin_profile', raw->>'linkedinProfile', '');
    v_phone      := NULLIF(COALESCE(raw->>'phone_number', raw->>'phoneNumber', ''), '');
    v_buyer_type := NULLIF(COALESCE(raw->>'buyer_type', raw->>'buyerType', ''), '');
    v_job_title  := NULLIF(COALESCE(raw->>'job_title', raw->>'jobTitle', ''), '');

    v_business_categories := COALESCE(NULLIF(raw->'business_categories','null'::jsonb), raw->'businessCategories', '[]'::jsonb);
    v_target_locations    := COALESCE(NULLIF(raw->'target_locations','null'::jsonb),    raw->'targetLocations',    '[]'::jsonb);
    v_investment_size     := COALESCE(NULLIF(raw->'investment_size','null'::jsonb),     raw->'investmentSize',     '[]'::jsonb);
    v_industry_expertise  := COALESCE(NULLIF(raw->'industry_expertise','null'::jsonb),  raw->'industryExpertise',  '[]'::jsonb);
    v_geographic_focus    := COALESCE(NULLIF(raw->'geographic_focus','null'::jsonb),    raw->'geographicFocus',    '[]'::jsonb);
    v_equity_source       := COALESCE(NULLIF(raw->'equity_source','null'::jsonb),       raw->'equitySource',       '[]'::jsonb);
    v_financing_plan      := COALESCE(NULLIF(raw->'financing_plan','null'::jsonb),      raw->'financingPlan',      '[]'::jsonb);
    v_operating_company_targets := COALESCE(NULLIF(raw->'operating_company_targets','null'::jsonb), raw->'operatingCompanyTargets', '[]'::jsonb);
    v_integration_plan    := COALESCE(NULLIF(raw->'integration_plan','null'::jsonb),    raw->'integrationPlan',    '[]'::jsonb);
    v_exclusions          := COALESCE(NULLIF(raw->'exclusions','null'::jsonb),          raw->'hardExclusions',     '[]'::jsonb);
    v_include_keywords    := COALESCE(NULLIF(raw->'include_keywords','null'::jsonb),    raw->'includeKeywords',    raw->'keywords', '[]'::jsonb);

    v_permanent_capital   := CASE WHEN raw ? 'permanent_capital' THEN (raw->>'permanent_capital')::boolean WHEN raw ? 'permanentCapital' THEN (raw->>'permanentCapital')::boolean ELSE NULL END;
    v_flex_subxm_ebitda   := CASE WHEN raw ? 'flex_subxm_ebitda' THEN (raw->>'flex_subxm_ebitda')::boolean WHEN raw ? 'flexSubXmEbitda' THEN (raw->>'flexSubXmEbitda')::boolean ELSE NULL END;
    v_flex_sub2m_ebitda   := CASE WHEN raw ? 'flex_sub2m_ebitda' THEN (raw->>'flex_sub2m_ebitda')::boolean WHEN raw ? 'flexSub2mEbitda' THEN (raw->>'flexSub2mEbitda')::boolean ELSE NULL END;

    v_target_deal_size_min := NULLIF(COALESCE(raw->>'target_deal_size_min', raw->>'targetDealSizeMin', ''), '')::numeric;
    v_target_deal_size_max := NULLIF(COALESCE(raw->>'target_deal_size_max', raw->>'targetDealSizeMax', ''), '')::numeric;

    v_company := NULLIF(COALESCE(raw->>'company', NULL), '');
    v_company_name := NULLIF(COALESCE(raw->>'company_name', raw->>'companyName', NULL), '');
    v_bio := NULLIF(COALESCE(raw->>'bio', NULL), '');
    v_deal_intent := NULLIF(COALESCE(raw->>'deal_intent', raw->>'dealIntent', NULL), '');
    v_revenue_range_min := NULLIF(COALESCE(raw->>'revenue_range_min', raw->>'revenueRangeMin', NULL), '');
    v_revenue_range_max := NULLIF(COALESCE(raw->>'revenue_range_max', raw->>'revenueRangeMax', NULL), '');
    v_specific_business_search := NULLIF(COALESCE(raw->>'specific_business_search', raw->>'specificBusinessSearch', NULL), '');
    v_ideal_target := NULLIF(COALESCE(raw->>'ideal_target', raw->>'idealTarget', NULL), '');
    v_ideal_target_description := NULLIF(COALESCE(raw->>'ideal_target_description', raw->>'idealTargetDescription', NULL), '');
    v_deal_structure_preference := NULLIF(COALESCE(raw->>'deal_structure_preference', raw->>'dealStructurePreference', NULL), '');

    v_portfolio_company_addon := NULLIF(COALESCE(raw->>'portfolio_company_addon', raw->>'portfolioCompanyAddon', NULL), '');
    v_deploying_capital_now := NULLIF(COALESCE(raw->>'deploying_capital_now', raw->>'deployingCapitalNow', NULL), '');
    v_owning_business_unit := NULLIF(COALESCE(raw->>'owning_business_unit', raw->>'owningBusinessUnit', NULL), '');
    v_deal_size_band := NULLIF(COALESCE(raw->>'deal_size_band', raw->>'dealSizeBand', NULL), '');
    v_corpdev_intent := NULLIF(COALESCE(raw->>'corpdev_intent', raw->>'corpDevIntent', NULL), '');
    v_discretion_type := NULLIF(COALESCE(raw->>'discretion_type', raw->>'discretionType', NULL), '');
    v_committed_equity_band := NULLIF(COALESCE(raw->>'committed_equity_band', raw->>'committedEquityBand', NULL), '');
    v_backers_summary := NULLIF(COALESCE(raw->>'backers_summary', raw->>'backersSummary', NULL), '');
    v_deployment_timing := NULLIF(COALESCE(raw->>'deployment_timing', raw->>'deploymentTiming', NULL), '');
    v_search_type := NULLIF(COALESCE(raw->>'search_type', raw->>'searchType', NULL), '');
    v_acq_equity_band := NULLIF(COALESCE(raw->>'acq_equity_band', raw->>'acqEquityBand', NULL), '');
    v_anchor_investors_summary := NULLIF(COALESCE(raw->>'anchor_investors_summary', raw->>'anchorInvestorsSummary', NULL), '');
    v_search_stage := NULLIF(COALESCE(raw->>'search_stage', raw->>'searchStage', NULL), '');
    v_on_behalf_of_buyer := NULLIF(COALESCE(raw->>'on_behalf_of_buyer', raw->>'onBehalfOfBuyer', NULL), '');
    v_buyer_role := NULLIF(COALESCE(raw->>'buyer_role', raw->>'buyerRole', NULL), '');
    v_buyer_org_url := NULLIF(COALESCE(raw->>'buyer_org_url', raw->>'buyerOrgUrl', NULL), '');
    v_mandate_blurb := NULLIF(COALESCE(raw->>'mandate_blurb', raw->>'mandateBlurb', NULL), '');
    v_owner_intent := NULLIF(COALESCE(raw->>'owner_intent', raw->>'ownerIntent', NULL), '');
    v_owner_timeline := NULLIF(COALESCE(raw->>'owner_timeline', raw->>'ownerTimeline', NULL), '');
    v_max_equity_today_band := NULLIF(COALESCE(raw->>'max_equity_today_band', raw->>'maxEquityTodayBand', NULL), '');
    v_uses_bank_finance := NULLIF(COALESCE(raw->>'uses_bank_finance', raw->>'usesBankFinance', NULL), '');

    v_estimated_revenue := NULLIF(COALESCE(raw->>'estimated_revenue', raw->>'estimatedRevenue', NULL), '');
    v_fund_size := NULLIF(COALESCE(raw->>'fund_size', raw->>'fundSize', NULL), '');
    v_aum := NULLIF(COALESCE(raw->>'aum', raw->>'AUM', NULL), '');
    v_is_funded := NULLIF(COALESCE(raw->>'is_funded', raw->>'isFunded', NULL), '');
    v_funded_by := NULLIF(COALESCE(raw->>'funded_by', raw->>'fundedBy', NULL), '');
    v_target_company_size := NULLIF(COALESCE(raw->>'target_company_size', raw->>'targetCompanySize', NULL), '');
    v_funding_source := NULLIF(COALESCE(raw->>'funding_source', raw->>'fundingSource', NULL), '');
    v_needs_loan := NULLIF(COALESCE(raw->>'needs_loan', raw->>'needsLoan', NULL), '');

    UPDATE public.profiles p SET
      first_name = COALESCE(NULLIF(v_first_name,''), p.first_name),
      last_name = COALESCE(NULLIF(v_last_name,''), p.last_name),
      website = COALESCE(NULLIF(v_website,''), p.website),
      linkedin_profile = COALESCE(NULLIF(v_linkedin,''), p.linkedin_profile),
      phone_number = COALESCE(NULLIF(v_phone,''), p.phone_number),
      buyer_type = COALESCE(NULLIF(v_buyer_type,''), p.buyer_type),
      job_title = COALESCE(NULLIF(v_job_title,''), p.job_title),
      business_categories = CASE WHEN v_business_categories IS NOT NULL AND jsonb_array_length(v_business_categories) > 0 THEN v_business_categories ELSE p.business_categories END,
      target_locations = CASE WHEN v_target_locations IS NOT NULL AND jsonb_array_length(v_target_locations) > 0 THEN v_target_locations ELSE p.target_locations END,
      investment_size = CASE WHEN v_investment_size IS NOT NULL AND jsonb_array_length(v_investment_size) > 0 THEN v_investment_size ELSE p.investment_size END,
      industry_expertise = CASE WHEN v_industry_expertise IS NOT NULL AND jsonb_array_length(v_industry_expertise) > 0 THEN v_industry_expertise ELSE p.industry_expertise END,
      geographic_focus = CASE WHEN v_geographic_focus IS NOT NULL AND jsonb_array_length(v_geographic_focus) > 0 THEN v_geographic_focus ELSE p.geographic_focus END,
      equity_source = CASE WHEN v_equity_source IS NOT NULL AND jsonb_array_length(v_equity_source) > 0 THEN v_equity_source ELSE p.equity_source END,
      financing_plan = CASE WHEN v_financing_plan IS NOT NULL AND jsonb_array_length(v_financing_plan) > 0 THEN v_financing_plan ELSE p.financing_plan END,
      operating_company_targets = CASE WHEN v_operating_company_targets IS NOT NULL AND jsonb_array_length(v_operating_company_targets) > 0 THEN v_operating_company_targets ELSE p.operating_company_targets END,
      integration_plan = CASE WHEN v_integration_plan IS NOT NULL AND jsonb_array_length(v_integration_plan) > 0 THEN v_integration_plan ELSE p.integration_plan END,
      exclusions = CASE WHEN v_exclusions IS NOT NULL AND jsonb_array_length(v_exclusions) > 0 THEN v_exclusions ELSE p.exclusions END,
      include_keywords = CASE WHEN v_include_keywords IS NOT NULL AND jsonb_array_length(v_include_keywords) > 0 THEN v_include_keywords ELSE p.include_keywords END,
      permanent_capital = COALESCE(v_permanent_capital, p.permanent_capital),
      flex_subxm_ebitda = COALESCE(v_flex_subxm_ebitda, p.flex_subxm_ebitda),
      flex_sub2m_ebitda = COALESCE(v_flex_sub2m_ebitda, p.flex_sub2m_ebitda),
      target_deal_size_min = COALESCE(v_target_deal_size_min, p.target_deal_size_min),
      target_deal_size_max = COALESCE(v_target_deal_size_max, p.target_deal_size_max),
      company = COALESCE(NULLIF(v_company,''), p.company),
      company_name = COALESCE(NULLIF(v_company_name,''), p.company_name),
      bio = COALESCE(NULLIF(v_bio,''), p.bio),
      deal_intent = COALESCE(NULLIF(v_deal_intent,''), p.deal_intent),
      revenue_range_min = COALESCE(NULLIF(v_revenue_range_min,''), p.revenue_range_min),
      revenue_range_max = COALESCE(NULLIF(v_revenue_range_max,''), p.revenue_range_max),
      specific_business_search = COALESCE(NULLIF(v_specific_business_search,''), p.specific_business_search),
      portfolio_company_addon = COALESCE(NULLIF(v_portfolio_company_addon,''), p.portfolio_company_addon),
      deploying_capital_now = COALESCE(NULLIF(v_deploying_capital_now,''), p.deploying_capital_now),
      owning_business_unit = COALESCE(NULLIF(v_owning_business_unit,''), p.owning_business_unit),
      deal_size_band = COALESCE(NULLIF(v_deal_size_band,''), p.deal_size_band),
      corpdev_intent = COALESCE(NULLIF(v_corpdev_intent,''), p.corpdev_intent),
      discretion_type = COALESCE(NULLIF(v_discretion_type,''), p.discretion_type),
      committed_equity_band = COALESCE(NULLIF(v_committed_equity_band,''), p.committed_equity_band),
      backers_summary = COALESCE(NULLIF(v_backers_summary,''), p.backers_summary),
      deployment_timing = COALESCE(NULLIF(v_deployment_timing,''), p.deployment_timing),
      search_type = COALESCE(NULLIF(v_search_type,''), p.search_type),
      acq_equity_band = COALESCE(NULLIF(v_acq_equity_band,''), p.acq_equity_band),
      anchor_investors_summary = COALESCE(NULLIF(v_anchor_investors_summary,''), p.anchor_investors_summary),
      search_stage = COALESCE(NULLIF(v_search_stage,''), p.search_stage),
      on_behalf_of_buyer = COALESCE(NULLIF(v_on_behalf_of_buyer,''), p.on_behalf_of_buyer),
      buyer_role = COALESCE(NULLIF(v_buyer_role,''), p.buyer_role),
      buyer_org_url = COALESCE(NULLIF(v_buyer_org_url,''), p.buyer_org_url),
      mandate_blurb = COALESCE(NULLIF(v_mandate_blurb,''), p.mandate_blurb),
      owner_intent = COALESCE(NULLIF(v_owner_intent,''), p.owner_intent),
      owner_timeline = COALESCE(NULLIF(v_owner_timeline,''), p.owner_timeline),
      max_equity_today_band = COALESCE(NULLIF(v_max_equity_today_band,''), p.max_equity_today_band),
      uses_bank_finance = COALESCE(NULLIF(v_uses_bank_finance,''), p.uses_bank_finance),
      ideal_target = COALESCE(NULLIF(v_ideal_target,''), p.ideal_target),
      ideal_target_description = COALESCE(NULLIF(v_ideal_target_description,''), p.ideal_target_description),
      deal_structure_preference = COALESCE(NULLIF(v_deal_structure_preference,''), p.deal_structure_preference),
      estimated_revenue = COALESCE(NULLIF(v_estimated_revenue,''), p.estimated_revenue),
      fund_size = COALESCE(NULLIF(v_fund_size,''), p.fund_size),
      aum = COALESCE(NULLIF(v_aum,''), p.aum),
      is_funded = COALESCE(NULLIF(v_is_funded,''), p.is_funded),
      funded_by = COALESCE(NULLIF(v_funded_by,''), p.funded_by),
      target_company_size = COALESCE(NULLIF(v_target_company_size,''), p.target_company_size),
      funding_source = COALESCE(NULLIF(v_funding_source,''), p.funding_source),
      needs_loan = COALESCE(NULLIF(v_needs_loan,''), p.needs_loan),
      updated_at = now()
    WHERE p.id = u.id;
  END LOOP;
END$$;