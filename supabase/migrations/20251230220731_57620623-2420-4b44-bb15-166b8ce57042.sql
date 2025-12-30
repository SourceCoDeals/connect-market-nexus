-- Update handle_new_user() function to include referral source and deal sourcing fields

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
  v_phone_number text;
  v_buyer_type text;
  v_website text;
  v_linkedin_profile text;
  v_business_categories jsonb;
  v_target_locations jsonb;
  v_investment_size jsonb;
  v_revenue_min text;
  v_revenue_max text;
  v_ebitda_min text;
  v_ebitda_max text;
  v_timeline text;
  v_additional_notes text;
  v_industry_expertise jsonb;
  v_geographic_focus jsonb;
  v_deal_preferences text;
  v_fund_name text;
  v_fund_size text;
  v_investment_criteria text;
  v_portfolio_companies text;
  v_equity_source jsonb;
  v_financing_plan jsonb;
  v_search_status text;
  v_target_close_date text;
  v_operating_experience text;
  v_operating_company_targets jsonb;
  v_partner_background text;
  v_integration_plan jsonb;
  v_investment_thesis text;
  v_exclusions jsonb;
  v_include_keywords jsonb;
  -- NEW: Referral source and deal sourcing fields
  v_referral_source text;
  v_referral_source_detail text;
  v_deal_sourcing_methods text[];
  v_target_acquisition_volume text;
BEGIN
  -- Extract values from metadata with safe defaults
  v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'firstName', '');
  v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'lastName', '');
  v_company := COALESCE(NEW.raw_user_meta_data->>'company', '');
  v_phone_number := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phoneNumber', '');
  v_buyer_type := COALESCE(NEW.raw_user_meta_data->>'buyer_type', NEW.raw_user_meta_data->>'buyerType', 'individual');
  v_website := COALESCE(NEW.raw_user_meta_data->>'website', '');
  v_linkedin_profile := COALESCE(NEW.raw_user_meta_data->>'linkedin_profile', NEW.raw_user_meta_data->>'linkedinProfile', '');
  
  -- JSONB array fields - keep as JSONB, don't convert to text[]
  v_business_categories := COALESCE(NEW.raw_user_meta_data->'business_categories', NEW.raw_user_meta_data->'businessCategories', '[]'::jsonb);
  v_target_locations := COALESCE(NEW.raw_user_meta_data->'target_locations', NEW.raw_user_meta_data->'targetLocations', '[]'::jsonb);
  v_investment_size := COALESCE(NEW.raw_user_meta_data->'investment_size', NEW.raw_user_meta_data->'investmentSize', '[]'::jsonb);
  v_industry_expertise := COALESCE(NEW.raw_user_meta_data->'industry_expertise', NEW.raw_user_meta_data->'industryExpertise', '[]'::jsonb);
  v_geographic_focus := COALESCE(NEW.raw_user_meta_data->'geographic_focus', NEW.raw_user_meta_data->'geographicFocus', '[]'::jsonb);
  v_equity_source := COALESCE(NEW.raw_user_meta_data->'equity_source', NEW.raw_user_meta_data->'equitySource', '[]'::jsonb);
  v_financing_plan := COALESCE(NEW.raw_user_meta_data->'financing_plan', NEW.raw_user_meta_data->'financingPlan', '[]'::jsonb);
  v_operating_company_targets := COALESCE(NEW.raw_user_meta_data->'operating_company_targets', NEW.raw_user_meta_data->'operatingCompanyTargets', '[]'::jsonb);
  v_integration_plan := COALESCE(NEW.raw_user_meta_data->'integration_plan', NEW.raw_user_meta_data->'integrationPlan', '[]'::jsonb);
  v_exclusions := COALESCE(NEW.raw_user_meta_data->'exclusions', '[]'::jsonb);
  v_include_keywords := COALESCE(NEW.raw_user_meta_data->'include_keywords', NEW.raw_user_meta_data->'includeKeywords', '[]'::jsonb);
  
  -- Text fields
  v_revenue_min := COALESCE(NEW.raw_user_meta_data->>'revenue_min', NEW.raw_user_meta_data->>'revenueMin', '');
  v_revenue_max := COALESCE(NEW.raw_user_meta_data->>'revenue_max', NEW.raw_user_meta_data->>'revenueMax', '');
  v_ebitda_min := COALESCE(NEW.raw_user_meta_data->>'ebitda_min', NEW.raw_user_meta_data->>'ebitdaMin', '');
  v_ebitda_max := COALESCE(NEW.raw_user_meta_data->>'ebitda_max', NEW.raw_user_meta_data->>'ebitdaMax', '');
  v_timeline := COALESCE(NEW.raw_user_meta_data->>'timeline', '');
  v_additional_notes := COALESCE(NEW.raw_user_meta_data->>'additional_notes', NEW.raw_user_meta_data->>'additionalNotes', '');
  v_deal_preferences := COALESCE(NEW.raw_user_meta_data->>'deal_preferences', NEW.raw_user_meta_data->>'dealPreferences', '');
  v_fund_name := COALESCE(NEW.raw_user_meta_data->>'fund_name', NEW.raw_user_meta_data->>'fundName', '');
  v_fund_size := COALESCE(NEW.raw_user_meta_data->>'fund_size', NEW.raw_user_meta_data->>'fundSize', '');
  v_investment_criteria := COALESCE(NEW.raw_user_meta_data->>'investment_criteria', NEW.raw_user_meta_data->>'investmentCriteria', '');
  v_portfolio_companies := COALESCE(NEW.raw_user_meta_data->>'portfolio_companies', NEW.raw_user_meta_data->>'portfolioCompanies', '');
  v_search_status := COALESCE(NEW.raw_user_meta_data->>'search_status', NEW.raw_user_meta_data->>'searchStatus', '');
  v_target_close_date := COALESCE(NEW.raw_user_meta_data->>'target_close_date', NEW.raw_user_meta_data->>'targetCloseDate', '');
  v_operating_experience := COALESCE(NEW.raw_user_meta_data->>'operating_experience', NEW.raw_user_meta_data->>'operatingExperience', '');
  v_partner_background := COALESCE(NEW.raw_user_meta_data->>'partner_background', NEW.raw_user_meta_data->>'partnerBackground', '');
  v_investment_thesis := COALESCE(NEW.raw_user_meta_data->>'investment_thesis', NEW.raw_user_meta_data->>'investmentThesis', '');

  -- NEW: Referral source and deal sourcing fields
  v_referral_source := COALESCE(NEW.raw_user_meta_data->>'referral_source', NEW.raw_user_meta_data->>'referralSource', '');
  v_referral_source_detail := COALESCE(NEW.raw_user_meta_data->>'referral_source_detail', NEW.raw_user_meta_data->>'referralSourceDetail', '');
  v_target_acquisition_volume := COALESCE(NEW.raw_user_meta_data->>'target_acquisition_volume', NEW.raw_user_meta_data->>'targetAcquisitionVolume', '');
  
  -- Convert deal_sourcing_methods from JSONB array to text[]
  v_deal_sourcing_methods := ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(NEW.raw_user_meta_data->'deal_sourcing_methods', NEW.raw_user_meta_data->'dealSourcingMethods', '[]'::jsonb)
    )
  );

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    company,
    phone_number,
    buyer_type,
    website,
    linkedin_profile,
    business_categories,
    target_locations,
    investment_size,
    revenue_min,
    revenue_max,
    ebitda_min,
    ebitda_max,
    timeline,
    additional_notes,
    industry_expertise,
    geographic_focus,
    deal_preferences,
    fund_name,
    fund_size,
    investment_criteria,
    portfolio_companies,
    equity_source,
    financing_plan,
    search_status,
    target_close_date,
    operating_experience,
    operating_company_targets,
    partner_background,
    integration_plan,
    investment_thesis,
    exclusions,
    include_keywords,
    -- NEW fields
    referral_source,
    referral_source_detail,
    deal_sourcing_methods,
    target_acquisition_volume,
    approval_status,
    email_verified,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_company,
    v_phone_number,
    v_buyer_type,
    v_website,
    v_linkedin_profile,
    v_business_categories,
    v_target_locations,
    v_investment_size,
    v_revenue_min,
    v_revenue_max,
    v_ebitda_min,
    v_ebitda_max,
    v_timeline,
    v_additional_notes,
    v_industry_expertise,
    v_geographic_focus,
    v_deal_preferences,
    v_fund_name,
    v_fund_size,
    v_investment_criteria,
    v_portfolio_companies,
    v_equity_source,
    v_financing_plan,
    v_search_status,
    v_target_close_date,
    v_operating_experience,
    v_operating_company_targets,
    v_partner_background,
    v_integration_plan,
    v_investment_thesis,
    v_exclusions,
    v_include_keywords,
    -- NEW field values
    NULLIF(v_referral_source, ''),
    NULLIF(v_referral_source_detail, ''),
    CASE WHEN array_length(v_deal_sourcing_methods, 1) > 0 THEN v_deal_sourcing_methods ELSE NULL END,
    NULLIF(v_target_acquisition_volume, ''),
    'pending',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;