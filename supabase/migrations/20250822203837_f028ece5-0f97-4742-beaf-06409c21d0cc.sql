-- Add Independent Sponsor specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_deal_size_min numeric,
ADD COLUMN IF NOT EXISTS target_deal_size_max numeric,
ADD COLUMN IF NOT EXISTS geographic_focus jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS industry_expertise jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deal_structure_preference text;

-- Make website and linkedin_profile required (NOT NULL) with default empty string for existing records
UPDATE public.profiles SET website = '' WHERE website IS NULL;
UPDATE public.profiles SET linkedin_profile = '' WHERE linkedin_profile IS NULL;

ALTER TABLE public.profiles 
ALTER COLUMN website SET NOT NULL,
ALTER COLUMN linkedin_profile SET NOT NULL;

-- Add check constraint for minimum character requirements on key fields
ALTER TABLE public.profiles 
ADD CONSTRAINT check_ideal_target_description_length 
CHECK (ideal_target_description IS NULL OR length(ideal_target_description) >= 50);

-- Update the handle_new_user function to support Independent Sponsor fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    email_verified,
    approval_status,
    is_admin,
    company,
    website,
    linkedin_profile,
    phone_number,
    buyer_type,
    ideal_target_description,
    business_categories,
    target_locations,
    revenue_range_min,
    revenue_range_max,
    specific_business_search,
    estimated_revenue,
    fund_size,
    investment_size,
    aum,
    is_funded,
    funded_by,
    target_company_size,
    funding_source,
    needs_loan,
    ideal_target,
    -- Independent sponsor fields
    target_deal_size_min,
    target_deal_size_max,
    geographic_focus,
    industry_expertise,
    deal_structure_preference,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email_confirmed_at IS NOT NULL,
    'pending',
    FALSE,
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    COALESCE(NEW.raw_user_meta_data->>'website', ''),
    COALESCE(NEW.raw_user_meta_data->>'linkedin_profile', COALESCE(NEW.raw_user_meta_data->>'linkedinProfile', '')),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', COALESCE(NEW.raw_user_meta_data->>'phoneNumber', '')),
    COALESCE(NEW.raw_user_meta_data->>'buyer_type', COALESCE(NEW.raw_user_meta_data->>'buyerType', 'corporate')),
    COALESCE(NEW.raw_user_meta_data->>'ideal_target_description', COALESCE(NEW.raw_user_meta_data->>'idealTargetDescription', '')),
    CASE 
      WHEN NEW.raw_user_meta_data ? 'business_categories' AND jsonb_typeof(NEW.raw_user_meta_data->'business_categories') = 'array' THEN NEW.raw_user_meta_data->'business_categories'
      WHEN NEW.raw_user_meta_data ? 'businessCategories' AND jsonb_typeof(NEW.raw_user_meta_data->'businessCategories') = 'array' THEN NEW.raw_user_meta_data->'businessCategories'
      WHEN NEW.raw_user_meta_data ? 'business_categories' AND (NEW.raw_user_meta_data->>'business_categories') LIKE '[%]'
        THEN (NEW.raw_user_meta_data->>'business_categories')::jsonb
      WHEN NEW.raw_user_meta_data ? 'businessCategories' AND (NEW.raw_user_meta_data->>'businessCategories') LIKE '[%]'
        THEN (NEW.raw_user_meta_data->>'businessCategories')::jsonb
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN NEW.raw_user_meta_data ? 'target_locations' AND jsonb_typeof(NEW.raw_user_meta_data->'target_locations') = 'array' THEN NEW.raw_user_meta_data->'target_locations'
      WHEN NEW.raw_user_meta_data ? 'targetLocations' AND jsonb_typeof(NEW.raw_user_meta_data->'targetLocations') = 'array' THEN NEW.raw_user_meta_data->'targetLocations'
      WHEN NEW.raw_user_meta_data ? 'target_locations' AND (NEW.raw_user_meta_data->>'target_locations') LIKE '[%]'
        THEN (NEW.raw_user_meta_data->>'target_locations')::jsonb
      WHEN NEW.raw_user_meta_data ? 'targetLocations' AND (NEW.raw_user_meta_data->>'targetLocations') LIKE '[%]'
        THEN (NEW.raw_user_meta_data->>'targetLocations')::jsonb
      WHEN COALESCE(NEW.raw_user_meta_data->>'target_locations', COALESCE(NEW.raw_user_meta_data->>'targetLocations','')) <> ''
        THEN jsonb_build_array(COALESCE(NEW.raw_user_meta_data->>'target_locations', NEW.raw_user_meta_data->>'targetLocations'))
      ELSE '[]'::jsonb
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'revenue_range_min' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'revenue_range_min')::numeric
      WHEN NEW.raw_user_meta_data->>'revenueRangeMin' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'revenueRangeMin')::numeric
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'revenue_range_max' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'revenue_range_max')::numeric
      WHEN NEW.raw_user_meta_data->>'revenueRangeMax' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'revenueRangeMax')::numeric
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'specific_business_search', COALESCE(NEW.raw_user_meta_data->>'specificBusinessSearch', '')),
    COALESCE(NEW.raw_user_meta_data->>'estimated_revenue', COALESCE(NEW.raw_user_meta_data->>'estimatedRevenue', '')),
    COALESCE(NEW.raw_user_meta_data->>'fund_size', COALESCE(NEW.raw_user_meta_data->>'fundSize', '')),
    COALESCE(NEW.raw_user_meta_data->>'investment_size', COALESCE(NEW.raw_user_meta_data->>'investmentSize', '')),
    COALESCE(NEW.raw_user_meta_data->>'aum', ''),
    COALESCE(NEW.raw_user_meta_data->>'is_funded', COALESCE(NEW.raw_user_meta_data->>'isFunded', '')),
    COALESCE(NEW.raw_user_meta_data->>'funded_by', COALESCE(NEW.raw_user_meta_data->>'fundedBy', '')),
    COALESCE(NEW.raw_user_meta_data->>'target_company_size', COALESCE(NEW.raw_user_meta_data->>'targetCompanySize', '')),
    COALESCE(NEW.raw_user_meta_data->>'funding_source', COALESCE(NEW.raw_user_meta_data->>'fundingSource', '')),
    COALESCE(NEW.raw_user_meta_data->>'needs_loan', COALESCE(NEW.raw_user_meta_data->>'needsLoan', '')),
    COALESCE(NEW.raw_user_meta_data->>'ideal_target', COALESCE(NEW.raw_user_meta_data->>'idealTarget', '')),
    -- Independent sponsor specific fields
    CASE 
      WHEN NEW.raw_user_meta_data->>'target_deal_size_min' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'target_deal_size_min')::numeric
      WHEN NEW.raw_user_meta_data->>'targetDealSizeMin' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'targetDealSizeMin')::numeric
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'target_deal_size_max' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'target_deal_size_max')::numeric
      WHEN NEW.raw_user_meta_data->>'targetDealSizeMax' ~ '^[0-9]+\.?[0-9]*([eE][+-]?[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'targetDealSizeMax')::numeric
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data ? 'geographic_focus' AND jsonb_typeof(NEW.raw_user_meta_data->'geographic_focus') = 'array' THEN NEW.raw_user_meta_data->'geographic_focus'
      WHEN NEW.raw_user_meta_data ? 'geographicFocus' AND jsonb_typeof(NEW.raw_user_meta_data->'geographicFocus') = 'array' THEN NEW.raw_user_meta_data->'geographicFocus'
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN NEW.raw_user_meta_data ? 'industry_expertise' AND jsonb_typeof(NEW.raw_user_meta_data->'industry_expertise') = 'array' THEN NEW.raw_user_meta_data->'industry_expertise'
      WHEN NEW.raw_user_meta_data ? 'industryExpertise' AND jsonb_typeof(NEW.raw_user_meta_data->'industryExpertise') = 'array' THEN NEW.raw_user_meta_data->'industryExpertise'
      ELSE '[]'::jsonb
    END,
    COALESCE(NEW.raw_user_meta_data->>'deal_structure_preference', COALESCE(NEW.raw_user_meta_data->>'dealStructurePreference', '')),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$;