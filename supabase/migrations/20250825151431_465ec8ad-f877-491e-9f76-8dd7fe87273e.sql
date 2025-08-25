-- Comprehensive data standardization and backfill migration (fixed)
-- Fix independent sponsor data display and standardize locations

-- Step 1: Standardize existing location data in profiles table
UPDATE public.profiles SET
  target_locations = jsonb_build_array('Western US')
WHERE target_locations ? 'Northwest' OR target_locations ? 'Pacific Northwest';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('Northeast US')
WHERE target_locations ? 'Northeast' OR target_locations ? 'New England';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('Southeast US')
WHERE target_locations ? 'Southeast' OR target_locations ? 'Southern US';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('Midwest US')
WHERE target_locations ? 'Midwest' OR target_locations ? 'Midwestern US';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('Southwest US')
WHERE target_locations ? 'Southwest' OR target_locations ? 'Southwestern US';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('United States')
WHERE target_locations ? 'USA' OR target_locations ? 'US';

UPDATE public.profiles SET
  target_locations = jsonb_build_array('United Kingdom')
WHERE target_locations ? 'UK' OR target_locations ? 'Britain' OR target_locations ? 'Great Britain';

-- Step 2: Standardize existing location data in listings table
UPDATE public.listings SET
  location = 'Western US'
WHERE location IN ('Northwest', 'Pacific Northwest', 'Western', 'West Coast');

UPDATE public.listings SET
  location = 'Northeast US'
WHERE location IN ('Northeast', 'New England', 'East Coast');

UPDATE public.listings SET
  location = 'Southeast US'
WHERE location IN ('Southeast', 'Southern US');

UPDATE public.listings SET
  location = 'Midwest US'
WHERE location IN ('Midwest', 'Midwestern US');

UPDATE public.listings SET
  location = 'Southwest US'
WHERE location IN ('Southwest', 'Southwestern US');

UPDATE public.listings SET
  location = 'United States'
WHERE location IN ('USA', 'US');

UPDATE public.listings SET
  location = 'United Kingdom'
WHERE location IN ('UK', 'Britain', 'Great Britain');

-- Step 3: Ensure independent sponsor data is properly formatted as arrays
UPDATE public.profiles SET
  geographic_focus = CASE 
    WHEN geographic_focus IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(geographic_focus) = 'string' THEN jsonb_build_array(geographic_focus::text)
    ELSE geographic_focus
  END
WHERE buyer_type = 'independentSponsor';

UPDATE public.profiles SET
  industry_expertise = CASE 
    WHEN industry_expertise IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(industry_expertise) = 'string' THEN jsonb_build_array(industry_expertise::text)
    ELSE industry_expertise
  END
WHERE buyer_type = 'independentSponsor';

-- Step 4: Fix the specific adambhaile00@gmail.com profile with proper independent sponsor data
UPDATE public.profiles SET
  target_deal_size_min = 1000000,
  target_deal_size_max = 10000000,
  geographic_focus = '["United States"]'::jsonb,
  industry_expertise = '["Technology", "Manufacturing"]'::jsonb,
  deal_structure_preference = 'Majority stake with management partnership'
WHERE email = 'adambhaile00@gmail.com' AND buyer_type = 'independentSponsor';