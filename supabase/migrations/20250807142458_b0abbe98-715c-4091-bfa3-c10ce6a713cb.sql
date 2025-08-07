-- Phase 1: Critical Data Standardization Migration
-- Convert target_locations from TEXT to JSONB array and standardize categories

-- Step 1: Add temporary column for target_locations as JSONB
ALTER TABLE public.profiles ADD COLUMN target_locations_temp JSONB DEFAULT '[]'::jsonb;

-- Step 2: Convert existing target_locations TEXT to JSONB arrays
UPDATE public.profiles 
SET target_locations_temp = CASE 
  WHEN target_locations IS NULL OR target_locations = '' THEN '[]'::jsonb
  WHEN target_locations = 'North America' THEN '["North America"]'::jsonb
  WHEN target_locations = 'Europe' THEN '["Europe"]'::jsonb
  WHEN target_locations = 'Asia' THEN '["Asia"]'::jsonb
  WHEN target_locations = 'Global' THEN '["Global"]'::jsonb
  WHEN target_locations LIKE '%,%' THEN 
    -- Handle comma-separated values by splitting and creating JSON array
    (
      SELECT jsonb_agg(trim(location))
      FROM unnest(string_to_array(target_locations, ',')) AS location
      WHERE trim(location) != ''
    )
  ELSE 
    -- Single location, wrap in array
    jsonb_build_array(target_locations)
END
WHERE target_locations_temp = '[]'::jsonb;

-- Step 3: Drop old column and rename new one
ALTER TABLE public.profiles DROP COLUMN target_locations;
ALTER TABLE public.profiles RENAME COLUMN target_locations_temp TO target_locations;

-- Step 4: Standardize remaining legacy categories in listings
UPDATE public.listings 
SET category = CASE 
  WHEN category = 'tech' OR category = 'Tech' THEN 'Technology'
  WHEN category = 'healthcare' OR category = 'Healthcare' THEN 'Healthcare & Medical'
  WHEN category = 'finance' OR category = 'Finance' THEN 'Financial Services'
  WHEN category = 'retail' OR category = 'Retail' THEN 'Retail & E-commerce'
  WHEN category = 'manufacturing' OR category = 'Manufacturing' THEN 'Manufacturing & Industrial'
  WHEN category = 'services' OR category = 'Services' THEN 'Professional Services'
  WHEN category = 'restaurant' OR category = 'Restaurant' THEN 'Food & Beverage'
  WHEN category = 'real estate' OR category = 'Real Estate' THEN 'Real Estate & Construction'
  WHEN category = 'education' OR category = 'Education' THEN 'Education & Training'
  WHEN category = 'logistics' OR category = 'Logistics' THEN 'Transportation & Logistics'
  WHEN category = 'energy' OR category = 'Energy' THEN 'Energy & Utilities'
  WHEN category = 'agriculture' OR category = 'Agriculture' THEN 'Agriculture & Food Production'
  WHEN category = 'entertainment' OR category = 'Entertainment' THEN 'Media & Entertainment'
  ELSE category
END;

-- Step 5: Standardize categories array in listings
UPDATE public.listings 
SET categories = CASE 
  WHEN categories IS NULL OR array_length(categories, 1) IS NULL THEN ARRAY[category]
  ELSE categories
END;

-- Step 6: Update categories array with standardized names
UPDATE public.listings 
SET categories = (
  SELECT array_agg(
    CASE 
      WHEN cat = 'tech' OR cat = 'Tech' THEN 'Technology'
      WHEN cat = 'healthcare' OR cat = 'Healthcare' THEN 'Healthcare & Medical'
      WHEN cat = 'finance' OR cat = 'Finance' THEN 'Financial Services'
      WHEN cat = 'retail' OR cat = 'Retail' THEN 'Retail & E-commerce'
      WHEN cat = 'manufacturing' OR cat = 'Manufacturing' THEN 'Manufacturing & Industrial'
      WHEN cat = 'services' OR cat = 'Services' THEN 'Professional Services'
      WHEN cat = 'restaurant' OR cat = 'Restaurant' THEN 'Food & Beverage'
      WHEN cat = 'real estate' OR cat = 'Real Estate' THEN 'Real Estate & Construction'
      WHEN cat = 'education' OR cat = 'Education' THEN 'Education & Training'
      WHEN cat = 'logistics' OR cat = 'Logistics' THEN 'Transportation & Logistics'
      WHEN cat = 'energy' OR cat = 'Energy' THEN 'Energy & Utilities'
      WHEN cat = 'agriculture' OR cat = 'Agriculture' THEN 'Agriculture & Food Production'
      WHEN cat = 'entertainment' OR cat = 'Entertainment' THEN 'Media & Entertainment'
      ELSE cat
    END
  )
  FROM unnest(categories) AS cat
);