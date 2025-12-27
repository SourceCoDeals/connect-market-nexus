-- Add referral source columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS referral_source_detail text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.referral_source IS 'How the user heard about SourceCo (e.g., google, linkedin, ai, etc.)';
COMMENT ON COLUMN public.profiles.referral_source_detail IS 'Follow-up detail about the referral source (e.g., which AI, what search term, etc.)';

-- Update the handle_new_user trigger function to extract referral fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Referral source fields (NEW)
  v_referral_source text := NULLIF(COALESCE(raw->>'referral_source', raw->>'referralSource', ''), '');
  v_referral_source_detail text := NULLIF(COALESCE(raw->>'referral_source_detail', raw->>'referralSourceDetail', ''), '');

  -- arrays (jsonb) with robust fallbacks and type safety
  v_business_categories jsonb;
  v_target_locations jsonb;
  v_investment_size jsonb;
  v_industry_expertise jsonb;
  v_geographic_focus jsonb;
  v_equity_source jsonb;
  v_financing_plan jsonb;
  v_operating_company_targets jsonb;
  v_integration_plan jsonb;
  v_exclusions jsonb;
  v_include_keywords jsonb;

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
  v_uses_bank_finance text := NULLIF(COALESCE(raw->>'uses_bank_finance', raw->>'usesBankFinance', raw->>'usesBank', NULL), '');
  v_max_equity_today_band text := NULLIF(COALESCE(raw->>'max_equity_today_band', raw->>'maxEquityTodayBand', raw->>'maxEquityToday', NULL), '');
  v_estimated_revenue text := NULLIF(COALESCE(raw->>'estimated_revenue', raw->>'estimatedRevenue', NULL), '');
  v_fund_size text := NULLIF(COALESCE(raw->>'fund_size', raw->>'fundSize', NULL), '');
  v_aum text := NULLIF(COALESCE(raw->>'aum', NULL), '');
  v_is_funded text := NULLIF(COALESCE(raw->>'is_funded', raw->>'isFunded', NULL), '');
  v_funded_by text := NULLIF(COALESCE(raw->>'funded_by', raw->>'fundedBy', NULL), '');
  v_target_company_size text := NULLIF(COALESCE(raw->>'target_company_size', raw->>'targetCompanySize', NULL), '');
  v_funding_source text := NULLIF(COALESCE(raw->>'funding_source', raw->>'fundingSource', NULL), '');
  v_needs_loan text := NULLIF(COALESCE(raw->>'needs_loan', raw->>'needsLoan', NULL), '');

BEGIN
  -- Parse arrays safely, accepting jsonb arrays OR stringified JSON
  v_business_categories := CASE
    WHEN jsonb_typeof(raw->'business_categories') = 'array' THEN raw->'business_categories'
    WHEN raw->>'business_categories' IS NOT NULL AND (raw->>'business_categories') ~ '^\[.*\]$' THEN (raw->>'business_categories')::jsonb
    ELSE '[]'::jsonb
  END;

  v_target_locations := CASE
    WHEN jsonb_typeof(raw->'target_locations') = 'array' THEN raw->'target_locations'
    WHEN raw->>'target_locations' IS NOT NULL AND (raw->>'target_locations') ~ '^\[.*\]$' THEN (raw->>'target_locations')::jsonb
    ELSE '[]'::jsonb
  END;

  v_investment_size := CASE
    WHEN jsonb_typeof(raw->'investment_size') = 'array' THEN raw->'investment_size'
    WHEN raw->>'investment_size' IS NOT NULL AND (raw->>'investment_size') ~ '^\[.*\]$' THEN (raw->>'investment_size')::jsonb
    ELSE '[]'::jsonb
  END;

  v_industry_expertise := CASE
    WHEN jsonb_typeof(raw->'industry_expertise') = 'array' THEN raw->'industry_expertise'
    WHEN raw->>'industry_expertise' IS NOT NULL AND (raw->>'industry_expertise') ~ '^\[.*\]$' THEN (raw->>'industry_expertise')::jsonb
    ELSE '[]'::jsonb
  END;

  v_geographic_focus := CASE
    WHEN jsonb_typeof(raw->'geographic_focus') = 'array' THEN raw->'geographic_focus'
    WHEN raw->>'geographic_focus' IS NOT NULL AND (raw->>'geographic_focus') ~ '^\[.*\]$' THEN (raw->>'geographic_focus')::jsonb
    ELSE '[]'::jsonb
  END;

  v_equity_source := CASE
    WHEN jsonb_typeof(raw->'equity_source') = 'array' THEN raw->'equity_source'
    WHEN raw->>'equity_source' IS NOT NULL AND (raw->>'equity_source') ~ '^\[.*\]$' THEN (raw->>'equity_source')::jsonb
    ELSE '[]'::jsonb
  END;

  v_financing_plan := CASE
    WHEN jsonb_typeof(raw->'financing_plan') = 'array' THEN raw->'financing_plan'
    WHEN raw->>'financing_plan' IS NOT NULL AND (raw->>'financing_plan') ~ '^\[.*\]$' THEN (raw->>'financing_plan')::jsonb
    ELSE '[]'::jsonb
  END;

  v_operating_company_targets := CASE
    WHEN jsonb_typeof(raw->'operating_company_targets') = 'array' THEN raw->'operating_company_targets'
    WHEN raw->>'operating_company_targets' IS NOT NULL AND (raw->>'operating_company_targets') ~ '^\[.*\]$' THEN (raw->>'operating_company_targets')::jsonb
    ELSE '[]'::jsonb
  END;

  v_integration_plan := CASE
    WHEN jsonb_typeof(raw->'integration_plan') = 'array' THEN raw->'integration_plan'
    WHEN raw->>'integration_plan' IS NOT NULL AND (raw->>'integration_plan') ~ '^\[.*\]$' THEN (raw->>'integration_plan')::jsonb
    ELSE '[]'::jsonb
  END;

  v_exclusions := CASE
    WHEN jsonb_typeof(raw->'exclusions') = 'array' THEN raw->'exclusions'
    WHEN raw->>'exclusions' IS NOT NULL AND (raw->>'exclusions') ~ '^\[.*\]$' THEN (raw->>'exclusions')::jsonb
    ELSE '[]'::jsonb
  END;

  v_include_keywords := CASE
    WHEN jsonb_typeof(raw->'include_keywords') = 'array' THEN raw->'include_keywords'
    WHEN raw->>'include_keywords' IS NOT NULL AND (raw->>'include_keywords') ~ '^\[.*\]$' THEN (raw->>'include_keywords')::jsonb
    ELSE '[]'::jsonb
  END;

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    company,
    company_name,
    website,
    linkedin_profile,
    phone_number,
    buyer_type,
    job_title,
    bio,
    -- investment/search criteria
    deal_intent,
    revenue_range_min,
    revenue_range_max,
    business_categories,
    target_locations,
    investment_size,
    industry_expertise,
    geographic_focus,
    specific_business_search,
    ideal_target,
    ideal_target_description,
    deal_structure_preference,
    target_deal_size_min,
    target_deal_size_max,
    -- buyer-type-specific
    portfolio_company_addon,
    deploying_capital_now,
    owning_business_unit,
    deal_size_band,
    integration_plan,
    corpdev_intent,
    discretion_type,
    permanent_capital,
    operating_company_targets,
    committed_equity_band,
    equity_source,
    flex_subxm_ebitda,
    backers_summary,
    deployment_timing,
    search_type,
    acq_equity_band,
    financing_plan,
    flex_sub2m_ebitda,
    anchor_investors_summary,
    search_stage,
    on_behalf_of_buyer,
    buyer_role,
    buyer_org_url,
    mandate_blurb,
    owner_intent,
    owner_timeline,
    uses_bank_finance,
    max_equity_today_band,
    estimated_revenue,
    fund_size,
    aum,
    is_funded,
    funded_by,
    target_company_size,
    funding_source,
    needs_loan,
    exclusions,
    include_keywords,
    -- referral tracking (NEW)
    referral_source,
    referral_source_detail,
    -- housekeeping
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_company,
    v_company_name,
    v_website,
    v_linkedin,
    v_phone,
    v_buyer_type,
    v_job_title,
    v_bio,
    v_deal_intent,
    v_revenue_range_min,
    v_revenue_range_max,
    ARRAY(SELECT jsonb_array_elements_text(v_business_categories)),
    ARRAY(SELECT jsonb_array_elements_text(v_target_locations)),
    ARRAY(SELECT jsonb_array_elements_text(v_investment_size)),
    ARRAY(SELECT jsonb_array_elements_text(v_industry_expertise)),
    ARRAY(SELECT jsonb_array_elements_text(v_geographic_focus)),
    v_specific_business_search,
    v_ideal_target,
    v_ideal_target_description,
    v_deal_structure_preference,
    v_target_deal_size_min,
    v_target_deal_size_max,
    v_portfolio_company_addon,
    v_deploying_capital_now,
    v_owning_business_unit,
    v_deal_size_band,
    ARRAY(SELECT jsonb_array_elements_text(v_integration_plan)),
    v_corpdev_intent,
    v_discretion_type,
    v_permanent_capital,
    ARRAY(SELECT jsonb_array_elements_text(v_operating_company_targets)),
    v_committed_equity_band,
    ARRAY(SELECT jsonb_array_elements_text(v_equity_source)),
    v_flex_subxm_ebitda,
    v_backers_summary,
    v_deployment_timing,
    v_search_type,
    v_acq_equity_band,
    ARRAY(SELECT jsonb_array_elements_text(v_financing_plan)),
    v_flex_sub2m_ebitda,
    v_anchor_investors_summary,
    v_search_stage,
    v_on_behalf_of_buyer,
    v_buyer_role,
    v_buyer_org_url,
    v_mandate_blurb,
    v_owner_intent,
    v_owner_timeline,
    v_uses_bank_finance,
    v_max_equity_today_band,
    v_estimated_revenue,
    v_fund_size,
    v_aum,
    v_is_funded,
    v_funded_by,
    v_target_company_size,
    v_funding_source,
    v_needs_loan,
    ARRAY(SELECT jsonb_array_elements_text(v_exclusions)),
    ARRAY(SELECT jsonb_array_elements_text(v_include_keywords)),
    v_referral_source,
    v_referral_source_detail,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$function$;