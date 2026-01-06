-- First, manually create the missing profile for sebin.mathew@mphasis.com
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
  geographic_focus,
  integration_plan,
  exclusions,
  include_keywords,
  referral_source,
  referral_source_detail,
  deal_sourcing_methods,
  target_acquisition_volume,
  job_title,
  revenue_range_min,
  revenue_range_max,
  corpdev_intent,
  deal_size_band,
  owning_business_unit,
  ideal_target_description,
  specific_business_search,
  approval_status,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'company', ''),
  COALESCE(u.raw_user_meta_data->>'phone_number', ''),
  COALESCE(u.raw_user_meta_data->>'buyer_type', 'individual'),
  COALESCE(u.raw_user_meta_data->>'website', ''),
  COALESCE(u.raw_user_meta_data->>'linkedin_profile', ''),
  COALESCE(u.raw_user_meta_data->'business_categories', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'target_locations', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'geographic_focus', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'integration_plan', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'exclusions', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'include_keywords', '[]'::jsonb),
  u.raw_user_meta_data->>'referral_source',
  u.raw_user_meta_data->>'referral_source_detail',
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(u.raw_user_meta_data->'deal_sourcing_methods', '[]'::jsonb))),
  u.raw_user_meta_data->>'target_acquisition_volume',
  u.raw_user_meta_data->>'job_title',
  u.raw_user_meta_data->>'revenue_range_min',
  u.raw_user_meta_data->>'revenue_range_max',
  u.raw_user_meta_data->>'corpdev_intent',
  u.raw_user_meta_data->>'deal_size_band',
  u.raw_user_meta_data->>'owning_business_unit',
  u.raw_user_meta_data->>'ideal_target_description',
  u.raw_user_meta_data->>'specific_business_search',
  'pending',
  COALESCE(u.email_confirmed_at IS NOT NULL, false),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'sebin.mathew@mphasis.com'
ON CONFLICT (id) DO NOTHING;

-- Now fix the handle_new_user trigger function to only use columns that actually exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_industry_expertise jsonb;
  v_geographic_focus jsonb;
  v_equity_source jsonb;
  v_financing_plan jsonb;
  v_operating_company_targets jsonb;
  v_integration_plan jsonb;
  v_exclusions jsonb;
  v_include_keywords jsonb;
  v_referral_source text;
  v_referral_source_detail text;
  v_deal_sourcing_methods text[];
  v_target_acquisition_volume text;
  -- Additional profile fields that actually exist
  v_job_title text;
  v_revenue_range_min text;
  v_revenue_range_max text;
  v_corpdev_intent text;
  v_deal_size_band text;
  v_owning_business_unit text;
  v_ideal_target_description text;
  v_specific_business_search text;
  v_deal_structure_preference text;
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
  
  -- Step 3 fields
  v_referral_source := COALESCE(NEW.raw_user_meta_data->>'referral_source', NEW.raw_user_meta_data->>'referralSource', '');
  v_referral_source_detail := COALESCE(NEW.raw_user_meta_data->>'referral_source_detail', NEW.raw_user_meta_data->>'referralSourceDetail', '');
  v_target_acquisition_volume := COALESCE(NEW.raw_user_meta_data->>'target_acquisition_volume', NEW.raw_user_meta_data->>'targetAcquisitionVolume', '');
  
  -- Additional profile fields that ACTUALLY EXIST in profiles table
  v_job_title := COALESCE(NEW.raw_user_meta_data->>'job_title', NEW.raw_user_meta_data->>'jobTitle', '');
  v_revenue_range_min := COALESCE(NEW.raw_user_meta_data->>'revenue_range_min', NEW.raw_user_meta_data->>'revenueRangeMin', '');
  v_revenue_range_max := COALESCE(NEW.raw_user_meta_data->>'revenue_range_max', NEW.raw_user_meta_data->>'revenueRangeMax', '');
  v_corpdev_intent := COALESCE(NEW.raw_user_meta_data->>'corpdev_intent', '');
  v_deal_size_band := COALESCE(NEW.raw_user_meta_data->>'deal_size_band', '');
  v_owning_business_unit := COALESCE(NEW.raw_user_meta_data->>'owning_business_unit', '');
  v_ideal_target_description := COALESCE(NEW.raw_user_meta_data->>'ideal_target_description', '');
  v_specific_business_search := COALESCE(NEW.raw_user_meta_data->>'specific_business_search', '');
  v_deal_structure_preference := COALESCE(NEW.raw_user_meta_data->>'deal_structure_preference', '');
  
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

  -- UPSERT: Insert or update on conflict - ONLY using columns that exist in profiles table
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
    industry_expertise,
    geographic_focus,
    equity_source,
    financing_plan,
    operating_company_targets,
    integration_plan,
    exclusions,
    include_keywords,
    referral_source,
    referral_source_detail,
    deal_sourcing_methods,
    target_acquisition_volume,
    job_title,
    revenue_range_min,
    revenue_range_max,
    corpdev_intent,
    deal_size_band,
    owning_business_unit,
    ideal_target_description,
    specific_business_search,
    deal_structure_preference,
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
    v_industry_expertise,
    v_geographic_focus,
    v_equity_source,
    v_financing_plan,
    v_operating_company_targets,
    v_integration_plan,
    v_exclusions,
    v_include_keywords,
    NULLIF(v_referral_source, ''),
    NULLIF(v_referral_source_detail, ''),
    CASE WHEN array_length(v_deal_sourcing_methods, 1) > 0 THEN v_deal_sourcing_methods ELSE NULL END,
    NULLIF(v_target_acquisition_volume, ''),
    NULLIF(v_job_title, ''),
    NULLIF(v_revenue_range_min, ''),
    NULLIF(v_revenue_range_max, ''),
    NULLIF(v_corpdev_intent, ''),
    NULLIF(v_deal_size_band, ''),
    NULLIF(v_owning_business_unit, ''),
    NULLIF(v_ideal_target_description, ''),
    NULLIF(v_specific_business_search, ''),
    NULLIF(v_deal_structure_preference, ''),
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
    -- Other fields that exist
    job_title = COALESCE(NULLIF(profiles.job_title, ''), EXCLUDED.job_title),
    revenue_range_min = COALESCE(NULLIF(profiles.revenue_range_min, ''), EXCLUDED.revenue_range_min),
    revenue_range_max = COALESCE(NULLIF(profiles.revenue_range_max, ''), EXCLUDED.revenue_range_max),
    corpdev_intent = COALESCE(NULLIF(profiles.corpdev_intent, ''), EXCLUDED.corpdev_intent),
    deal_size_band = COALESCE(NULLIF(profiles.deal_size_band, ''), EXCLUDED.deal_size_band),
    owning_business_unit = COALESCE(NULLIF(profiles.owning_business_unit, ''), EXCLUDED.owning_business_unit),
    ideal_target_description = COALESCE(profiles.ideal_target_description, EXCLUDED.ideal_target_description),
    specific_business_search = COALESCE(profiles.specific_business_search, EXCLUDED.specific_business_search),
    deal_structure_preference = COALESCE(NULLIF(profiles.deal_structure_preference, ''), EXCLUDED.deal_structure_preference),
    email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the actual error for debugging
    RAISE LOG 'Error in handle_new_user for user % (email: %): % - SQLSTATE: %', NEW.id, NEW.email, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Also backfill any other users who might have been affected (have auth user but no profile)
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
  geographic_focus,
  integration_plan,
  exclusions,
  include_keywords,
  referral_source,
  referral_source_detail,
  deal_sourcing_methods,
  target_acquisition_volume,
  job_title,
  revenue_range_min,
  revenue_range_max,
  corpdev_intent,
  deal_size_band,
  approval_status,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'company', ''),
  COALESCE(u.raw_user_meta_data->>'phone_number', ''),
  COALESCE(u.raw_user_meta_data->>'buyer_type', 'individual'),
  COALESCE(u.raw_user_meta_data->>'website', ''),
  COALESCE(u.raw_user_meta_data->>'linkedin_profile', ''),
  COALESCE(u.raw_user_meta_data->'business_categories', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'target_locations', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'geographic_focus', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'integration_plan', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'exclusions', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'include_keywords', '[]'::jsonb),
  u.raw_user_meta_data->>'referral_source',
  u.raw_user_meta_data->>'referral_source_detail',
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(u.raw_user_meta_data->'deal_sourcing_methods', '[]'::jsonb))),
  u.raw_user_meta_data->>'target_acquisition_volume',
  u.raw_user_meta_data->>'job_title',
  u.raw_user_meta_data->>'revenue_range_min',
  u.raw_user_meta_data->>'revenue_range_max',
  u.raw_user_meta_data->>'corpdev_intent',
  u.raw_user_meta_data->>'deal_size_band',
  'pending',
  COALESCE(u.email_confirmed_at IS NOT NULL, false),
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;