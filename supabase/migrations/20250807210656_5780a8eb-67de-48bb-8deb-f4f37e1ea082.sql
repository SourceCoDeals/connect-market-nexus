-- Create triggers to sync profiles on auth user changes and improve profile mapping
-- IMPORTANT: Uses existing SECURITY DEFINER functions; avoids modifying reserved schemas beyond trigger creation

-- 1) Trigger: create profile on new auth user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;

-- 2) Trigger: sync email verification status when auth user's email_confirmed_at changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_updated'
  ) THEN
    CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_verification_status();
  END IF;
END$$;

-- 3) Improve handle_new_user to properly map target_locations as JSONB array
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
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
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  INSERT INTO public.profiles (
    id, email, first_name, last_name, email_verified, approval_status, is_admin, buyer_type, business_categories, target_locations, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email_confirmed_at IS NOT NULL,
    'pending',
    FALSE,
    'corporate',
    '[]'::jsonb,
    '[]'::jsonb,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$;

-- 4) Backfill: Insert missing profiles and normalize target_locations
INSERT INTO public.profiles (
  id, email, first_name, last_name, email_verified, approval_status, is_admin, buyer_type,
  business_categories, target_locations, created_at, updated_at
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name',''),
  COALESCE(u.raw_user_meta_data->>'last_name',''),
  (u.email_confirmed_at IS NOT NULL),
  'pending',
  FALSE,
  COALESCE(u.raw_user_meta_data->>'buyer_type', COALESCE(u.raw_user_meta_data->>'buyerType','corporate')),
  CASE 
    WHEN u.raw_user_meta_data ? 'business_categories' AND jsonb_typeof(u.raw_user_meta_data->'business_categories')='array' THEN u.raw_user_meta_data->'business_categories'
    WHEN u.raw_user_meta_data ? 'businessCategories' AND jsonb_typeof(u.raw_user_meta_data->'businessCategories')='array' THEN u.raw_user_meta_data->'businessCategories'
    ELSE '[]'::jsonb END,
  CASE 
    WHEN u.raw_user_meta_data ? 'target_locations' AND jsonb_typeof(u.raw_user_meta_data->'target_locations')='array' THEN u.raw_user_meta_data->'target_locations'
    WHEN u.raw_user_meta_data ? 'targetLocations' AND jsonb_typeof(u.raw_user_meta_data->'targetLocations')='array' THEN u.raw_user_meta_data->'targetLocations'
    ELSE '[]'::jsonb END,
  NOW(), NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Normalize any profiles.target_locations that are stored as JSONB strings
UPDATE public.profiles
SET target_locations = CASE 
  WHEN target_locations::text IN ('"[]"','[]') THEN '[]'::jsonb
  WHEN jsonb_typeof(target_locations) = 'string' THEN jsonb_build_array(btrim(target_locations::text,'"'))
  ELSE target_locations
END,
updated_at = NOW()
WHERE target_locations IS NOT NULL AND (jsonb_typeof(target_locations) = 'string' OR target_locations::text = '"[]"');