-- Replace handle_new_user with robust upsert-based version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
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
  
  -- JSONB array fields
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

  -- Referral source and deal sourcing fields
  v_referral_source := COALESCE(NEW.raw_user_meta_data->>'referral_source', NEW.raw_user_meta_data->>'referralSource', '');
  v_referral_source_detail := COALESCE(NEW.raw_user_meta_data->>'referral_source_detail', NEW.raw_user_meta_data->>'referralSourceDetail', '');
  v_target_acquisition_volume := COALESCE(NEW.raw_user_meta_data->>'target_acquisition_volume', NEW.raw_user_meta_data->>'targetAcquisitionVolume', '');
  
  -- Convert deal_sourcing_methods from JSONB array to text[]
  BEGIN
    v_deal_sourcing_methods := ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(NEW.raw_user_meta_data->'deal_sourcing_methods', NEW.raw_user_meta_data->'dealSourcingMethods', '[]'::jsonb)
      )
    );
  EXCEPTION WHEN others THEN
    v_deal_sourcing_methods := NULL;
  END;

  -- UPSERT: Insert or update on conflict
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
    NULLIF(v_referral_source, ''),
    NULLIF(v_referral_source_detail, ''),
    CASE WHEN array_length(v_deal_sourcing_methods, 1) > 0 THEN v_deal_sourcing_methods ELSE NULL END,
    NULLIF(v_target_acquisition_volume, ''),
    'pending',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Only update fields if the incoming value is meaningful and existing is empty/null
    first_name = COALESCE(NULLIF(profiles.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(profiles.last_name, ''), EXCLUDED.last_name),
    company = COALESCE(NULLIF(profiles.company, ''), EXCLUDED.company),
    phone_number = COALESCE(NULLIF(profiles.phone_number, ''), EXCLUDED.phone_number),
    buyer_type = COALESCE(NULLIF(profiles.buyer_type, ''), EXCLUDED.buyer_type),
    website = COALESCE(NULLIF(profiles.website, ''), EXCLUDED.website),
    linkedin_profile = COALESCE(NULLIF(profiles.linkedin_profile, ''), EXCLUDED.linkedin_profile),
    business_categories = CASE 
      WHEN profiles.business_categories IS NULL OR profiles.business_categories = '[]'::jsonb 
      THEN EXCLUDED.business_categories 
      ELSE profiles.business_categories 
    END,
    target_locations = CASE 
      WHEN profiles.target_locations IS NULL OR profiles.target_locations = '[]'::jsonb 
      THEN EXCLUDED.target_locations 
      ELSE profiles.target_locations 
    END,
    investment_size = CASE 
      WHEN profiles.investment_size IS NULL OR profiles.investment_size = '[]'::jsonb 
      THEN EXCLUDED.investment_size 
      ELSE profiles.investment_size 
    END,
    industry_expertise = CASE 
      WHEN profiles.industry_expertise IS NULL OR profiles.industry_expertise = '[]'::jsonb 
      THEN EXCLUDED.industry_expertise 
      ELSE profiles.industry_expertise 
    END,
    geographic_focus = CASE 
      WHEN profiles.geographic_focus IS NULL OR profiles.geographic_focus = '[]'::jsonb 
      THEN EXCLUDED.geographic_focus 
      ELSE profiles.geographic_focus 
    END,
    equity_source = CASE 
      WHEN profiles.equity_source IS NULL OR profiles.equity_source = '[]'::jsonb 
      THEN EXCLUDED.equity_source 
      ELSE profiles.equity_source 
    END,
    financing_plan = CASE 
      WHEN profiles.financing_plan IS NULL OR profiles.financing_plan = '[]'::jsonb 
      THEN EXCLUDED.financing_plan 
      ELSE profiles.financing_plan 
    END,
    operating_company_targets = CASE 
      WHEN profiles.operating_company_targets IS NULL OR profiles.operating_company_targets = '[]'::jsonb 
      THEN EXCLUDED.operating_company_targets 
      ELSE profiles.operating_company_targets 
    END,
    integration_plan = CASE 
      WHEN profiles.integration_plan IS NULL OR profiles.integration_plan = '[]'::jsonb 
      THEN EXCLUDED.integration_plan 
      ELSE profiles.integration_plan 
    END,
    exclusions = CASE 
      WHEN profiles.exclusions IS NULL OR profiles.exclusions = '[]'::jsonb 
      THEN EXCLUDED.exclusions 
      ELSE profiles.exclusions 
    END,
    include_keywords = CASE 
      WHEN profiles.include_keywords IS NULL OR profiles.include_keywords = '[]'::jsonb 
      THEN EXCLUDED.include_keywords 
      ELSE profiles.include_keywords 
    END,
    -- Step 3 fields - always update if incoming value is meaningful and existing is null
    referral_source = COALESCE(profiles.referral_source, EXCLUDED.referral_source),
    referral_source_detail = COALESCE(profiles.referral_source_detail, EXCLUDED.referral_source_detail),
    deal_sourcing_methods = COALESCE(profiles.deal_sourcing_methods, EXCLUDED.deal_sourcing_methods),
    target_acquisition_volume = COALESCE(profiles.target_acquisition_volume, EXCLUDED.target_acquisition_volume),
    -- Other fields
    revenue_min = COALESCE(NULLIF(profiles.revenue_min, ''), EXCLUDED.revenue_min),
    revenue_max = COALESCE(NULLIF(profiles.revenue_max, ''), EXCLUDED.revenue_max),
    ebitda_min = COALESCE(NULLIF(profiles.ebitda_min, ''), EXCLUDED.ebitda_min),
    ebitda_max = COALESCE(NULLIF(profiles.ebitda_max, ''), EXCLUDED.ebitda_max),
    timeline = COALESCE(NULLIF(profiles.timeline, ''), EXCLUDED.timeline),
    additional_notes = COALESCE(profiles.additional_notes, EXCLUDED.additional_notes),
    deal_preferences = COALESCE(NULLIF(profiles.deal_preferences, ''), EXCLUDED.deal_preferences),
    fund_name = COALESCE(NULLIF(profiles.fund_name, ''), EXCLUDED.fund_name),
    fund_size = COALESCE(NULLIF(profiles.fund_size, ''), EXCLUDED.fund_size),
    investment_criteria = COALESCE(profiles.investment_criteria, EXCLUDED.investment_criteria),
    portfolio_companies = COALESCE(profiles.portfolio_companies, EXCLUDED.portfolio_companies),
    search_status = COALESCE(NULLIF(profiles.search_status, ''), EXCLUDED.search_status),
    target_close_date = COALESCE(NULLIF(profiles.target_close_date, ''), EXCLUDED.target_close_date),
    operating_experience = COALESCE(profiles.operating_experience, EXCLUDED.operating_experience),
    partner_background = COALESCE(profiles.partner_background, EXCLUDED.partner_background),
    investment_thesis = COALESCE(profiles.investment_thesis, EXCLUDED.investment_thesis),
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Backfill ALL existing users who have metadata but missing Step 3 fields in profiles
UPDATE public.profiles p
SET 
  referral_source = COALESCE(p.referral_source, NULLIF(au.raw_user_meta_data->>'referral_source', ''), NULLIF(au.raw_user_meta_data->>'referralSource', '')),
  referral_source_detail = COALESCE(p.referral_source_detail, NULLIF(au.raw_user_meta_data->>'referral_source_detail', ''), NULLIF(au.raw_user_meta_data->>'referralSourceDetail', '')),
  target_acquisition_volume = COALESCE(p.target_acquisition_volume, NULLIF(au.raw_user_meta_data->>'target_acquisition_volume', ''), NULLIF(au.raw_user_meta_data->>'targetAcquisitionVolume', '')),
  deal_sourcing_methods = COALESCE(
    p.deal_sourcing_methods,
    CASE 
      WHEN au.raw_user_meta_data->'deal_sourcing_methods' IS NOT NULL 
           AND jsonb_typeof(au.raw_user_meta_data->'deal_sourcing_methods') = 'array'
           AND jsonb_array_length(au.raw_user_meta_data->'deal_sourcing_methods') > 0
      THEN ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'deal_sourcing_methods'))
      WHEN au.raw_user_meta_data->'dealSourcingMethods' IS NOT NULL 
           AND jsonb_typeof(au.raw_user_meta_data->'dealSourcingMethods') = 'array'
           AND jsonb_array_length(au.raw_user_meta_data->'dealSourcingMethods') > 0
      THEN ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'dealSourcingMethods'))
      ELSE NULL
    END
  ),
  -- Also backfill other key arrays that might be missing
  business_categories = CASE 
    WHEN p.business_categories IS NULL OR p.business_categories = '[]'::jsonb
    THEN COALESCE(au.raw_user_meta_data->'business_categories', au.raw_user_meta_data->'businessCategories', '[]'::jsonb)
    ELSE p.business_categories
  END,
  target_locations = CASE 
    WHEN p.target_locations IS NULL OR p.target_locations = '[]'::jsonb
    THEN COALESCE(au.raw_user_meta_data->'target_locations', au.raw_user_meta_data->'targetLocations', '[]'::jsonb)
    ELSE p.target_locations
  END,
  updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id
  AND (
    -- Has Step 3 data in metadata but missing in profiles
    (p.referral_source IS NULL AND (au.raw_user_meta_data->>'referral_source' IS NOT NULL OR au.raw_user_meta_data->>'referralSource' IS NOT NULL))
    OR (p.deal_sourcing_methods IS NULL AND (au.raw_user_meta_data->'deal_sourcing_methods' IS NOT NULL OR au.raw_user_meta_data->'dealSourcingMethods' IS NOT NULL))
    OR (p.target_acquisition_volume IS NULL AND (au.raw_user_meta_data->>'target_acquisition_volume' IS NOT NULL OR au.raw_user_meta_data->>'targetAcquisitionVolume' IS NOT NULL))
    -- Or has missing key arrays
    OR ((p.business_categories IS NULL OR p.business_categories = '[]'::jsonb) AND (au.raw_user_meta_data->'business_categories' IS NOT NULL OR au.raw_user_meta_data->'businessCategories' IS NOT NULL))
    OR ((p.target_locations IS NULL OR p.target_locations = '[]'::jsonb) AND (au.raw_user_meta_data->'target_locations' IS NOT NULL OR au.raw_user_meta_data->'targetLocations' IS NOT NULL))
  );