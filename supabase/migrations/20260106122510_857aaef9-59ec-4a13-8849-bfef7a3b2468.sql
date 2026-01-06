-- Create trigger_logs table for monitoring trigger failures
CREATE TABLE IF NOT EXISTS public.trigger_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_name text NOT NULL,
  user_id uuid,
  user_email text,
  status text NOT NULL DEFAULT 'error',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trigger_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view trigger logs
CREATE POLICY "Admins can view trigger logs" ON public.trigger_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Create index for querying recent failures
CREATE INDEX idx_trigger_logs_created_at ON public.trigger_logs(created_at DESC);
CREATE INDEX idx_trigger_logs_trigger_name ON public.trigger_logs(trigger_name);

-- Update handle_new_user() to log errors to trigger_logs table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Boolean fields
  BEGIN
    v_permanent_capital := (NEW.raw_user_meta_data->>'permanent_capital')::boolean;
  EXCEPTION WHEN others THEN
    v_permanent_capital := NULL;
  END;
  BEGIN
    v_flex_subxm_ebitda := (NEW.raw_user_meta_data->>'flex_subxm_ebitda')::boolean;
  EXCEPTION WHEN others THEN
    v_flex_subxm_ebitda := NULL;
  END;
  BEGIN
    v_flex_sub2m_ebitda := (NEW.raw_user_meta_data->>'flex_sub2m_ebitda')::boolean;
  EXCEPTION WHEN others THEN
    v_flex_sub2m_ebitda := NULL;
  END;

  -- Numeric fields
  BEGIN
    v_target_deal_size_min := (NEW.raw_user_meta_data->>'target_deal_size_min')::bigint;
  EXCEPTION WHEN others THEN
    v_target_deal_size_min := NULL;
  END;
  BEGIN
    v_target_deal_size_max := (NEW.raw_user_meta_data->>'target_deal_size_max')::bigint;
  EXCEPTION WHEN others THEN
    v_target_deal_size_max := NULL;
  END;

  -- Array fields - use helper to convert JSON arrays to PostgreSQL arrays
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

  -- Deal sourcing methods array
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
    v_business_categories,
    v_target_locations,
    v_investment_size,
    v_geographic_focus,
    v_industry_expertise,
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
    v_integration_plan,
    v_corpdev_intent,
    v_discretion_type,
    v_committed_equity_band,
    v_equity_source,
    v_deployment_timing,
    v_target_deal_size_min,
    v_target_deal_size_max,
    v_deal_structure_preference,
    v_permanent_capital,
    v_operating_company_targets,
    v_flex_subxm_ebitda,
    v_search_type,
    v_acq_equity_band,
    v_financing_plan,
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
    v_exclusions,
    v_include_keywords,
    v_referral_source,
    v_referral_source_detail,
    v_deal_sourcing_methods,
    v_target_acquisition_volume,
    'pending',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = CASE WHEN NULLIF(EXCLUDED.first_name, '') IS NOT NULL THEN EXCLUDED.first_name ELSE profiles.first_name END,
    last_name = CASE WHEN NULLIF(EXCLUDED.last_name, '') IS NOT NULL THEN EXCLUDED.last_name ELSE profiles.last_name END,
    company = CASE WHEN NULLIF(EXCLUDED.company, '') IS NOT NULL THEN EXCLUDED.company ELSE profiles.company END,
    buyer_type = CASE WHEN NULLIF(EXCLUDED.buyer_type, '') IS NOT NULL THEN EXCLUDED.buyer_type ELSE profiles.buyer_type END,
    website = CASE WHEN NULLIF(EXCLUDED.website, '') IS NOT NULL THEN EXCLUDED.website ELSE profiles.website END,
    linkedin_profile = CASE WHEN NULLIF(EXCLUDED.linkedin_profile, '') IS NOT NULL THEN EXCLUDED.linkedin_profile ELSE profiles.linkedin_profile END,
    phone_number = CASE WHEN NULLIF(EXCLUDED.phone_number, '') IS NOT NULL THEN EXCLUDED.phone_number ELSE profiles.phone_number END,
    job_title = CASE WHEN NULLIF(EXCLUDED.job_title, '') IS NOT NULL THEN EXCLUDED.job_title ELSE profiles.job_title END,
    business_categories = CASE WHEN array_length(EXCLUDED.business_categories, 1) > 0 THEN EXCLUDED.business_categories ELSE profiles.business_categories END,
    target_locations = CASE WHEN array_length(EXCLUDED.target_locations, 1) > 0 THEN EXCLUDED.target_locations ELSE profiles.target_locations END,
    investment_size = CASE WHEN array_length(EXCLUDED.investment_size, 1) > 0 THEN EXCLUDED.investment_size ELSE profiles.investment_size END,
    geographic_focus = CASE WHEN array_length(EXCLUDED.geographic_focus, 1) > 0 THEN EXCLUDED.geographic_focus ELSE profiles.geographic_focus END,
    industry_expertise = CASE WHEN array_length(EXCLUDED.industry_expertise, 1) > 0 THEN EXCLUDED.industry_expertise ELSE profiles.industry_expertise END,
    referral_source = CASE WHEN NULLIF(EXCLUDED.referral_source, '') IS NOT NULL THEN EXCLUDED.referral_source ELSE profiles.referral_source END,
    referral_source_detail = CASE WHEN NULLIF(EXCLUDED.referral_source_detail, '') IS NOT NULL THEN EXCLUDED.referral_source_detail ELSE profiles.referral_source_detail END,
    deal_sourcing_methods = CASE WHEN array_length(EXCLUDED.deal_sourcing_methods, 1) > 0 THEN EXCLUDED.deal_sourcing_methods ELSE profiles.deal_sourcing_methods END,
    target_acquisition_volume = CASE WHEN NULLIF(EXCLUDED.target_acquisition_volume, '') IS NOT NULL THEN EXCLUDED.target_acquisition_volume ELSE profiles.target_acquisition_volume END;
  
  -- Log success
  INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, metadata)
  VALUES ('handle_new_user', NEW.id, NEW.email, 'success', jsonb_build_object('action', 'profile_created'));

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Log the error to trigger_logs table for visibility
  INSERT INTO public.trigger_logs (trigger_name, user_id, user_email, status, error_message, metadata)
  VALUES ('handle_new_user', NEW.id, NEW.email, 'error', SQLERRM, jsonb_build_object('sqlstate', SQLSTATE));
  
  RAISE LOG 'handle_new_user trigger failed for user % (%): %', NEW.id, NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create function to check for orphaned auth users (users without profiles)
CREATE OR REPLACE FUNCTION public.check_orphaned_auth_users()
RETURNS TABLE(user_id uuid, user_email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE p.id IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.check_orphaned_auth_users() TO service_role;