-- Add "United States" as the first location option and standardize categories
-- First, let's add the new "United States" location and update existing data

-- Update any profiles that might have inconsistent location data
UPDATE public.profiles 
SET target_locations = 'United States'
WHERE target_locations IS NULL OR target_locations = '' OR target_locations = 'National' OR target_locations = 'national' OR target_locations = 'US' OR target_locations = 'USA';

-- Update any listings that might have inconsistent location data  
UPDATE public.listings
SET location = 'United States'
WHERE location = 'National' OR location = 'national' OR location = 'US' OR location = 'USA';

-- Standardize business categories in profiles - convert old inconsistent categories to new standardized ones
UPDATE public.profiles 
SET business_categories = CASE 
  WHEN business_categories::text LIKE '%technology%' OR business_categories::text LIKE '%tech%' OR business_categories::text LIKE '%online%' THEN '["Technology"]'::jsonb
  WHEN business_categories::text LIKE '%healthcare%' OR business_categories::text LIKE '%health%' THEN '["Healthcare"]'::jsonb
  WHEN business_categories::text LIKE '%financial%' OR business_categories::text LIKE '%finance%' THEN '["Finance & Insurance"]'::jsonb
  WHEN business_categories::text LIKE '%manufacturing%' THEN '["Manufacturing"]'::jsonb
  WHEN business_categories::text LIKE '%retail%' THEN '["Retail & E-commerce"]'::jsonb
  WHEN business_categories::text LIKE '%real estate%' OR business_categories::text LIKE '%realestate%' THEN '["Real Estate"]'::jsonb
  WHEN business_categories::text LIKE '%restaurant%' OR business_categories::text LIKE '%food%' THEN '["Food & Beverage"]'::jsonb
  WHEN business_categories::text LIKE '%professional%' THEN '["Professional Services"]'::jsonb
  WHEN business_categories::text LIKE '%construction%' OR business_categories::text LIKE '%building%' THEN '["Construction"]'::jsonb
  WHEN business_categories::text LIKE '%transportation%' OR business_categories::text LIKE '%logistics%' THEN '["Transportation & Logistics"]'::jsonb
  WHEN business_categories::text LIKE '%energy%' OR business_categories::text LIKE '%utilities%' THEN '["Energy & Utilities"]'::jsonb
  WHEN business_categories::text LIKE '%education%' THEN '["Education"]'::jsonb
  WHEN business_categories::text LIKE '%entertainment%' OR business_categories::text LIKE '%media%' THEN '["Entertainment & Media"]'::jsonb
  WHEN business_categories::text LIKE '%agriculture%' THEN '["Agriculture"]'::jsonb
  WHEN business_categories::text LIKE '%automotive%' THEN '["Automotive"]'::jsonb
  WHEN business_categories::text LIKE '%telecommunication%' OR business_categories::text LIKE '%communication%' THEN '["Telecommunications"]'::jsonb
  WHEN business_categories::text LIKE '%aerospace%' OR business_categories::text LIKE '%defense%' THEN '["Aerospace & Defense"]'::jsonb
  WHEN business_categories::text LIKE '%chemical%' THEN '["Chemicals"]'::jsonb
  WHEN business_categories::text LIKE '%consumer%' THEN '["Consumer Goods"]'::jsonb
  WHEN business_categories::text LIKE '%any%' OR business_categories::text = '[]' THEN '["Technology", "Healthcare", "Finance & Insurance", "Manufacturing", "Retail & E-commerce", "Real Estate", "Food & Beverage", "Professional Services", "Construction", "Transportation & Logistics", "Energy & Utilities", "Education", "Entertainment & Media", "Agriculture", "Automotive", "Telecommunications", "Aerospace & Defense", "Chemicals", "Consumer Goods", "Other"]'::jsonb
  ELSE '["Other"]'::jsonb
END
WHERE business_categories IS NOT NULL;

-- Standardize listing categories - convert old category format to new standardized format
UPDATE public.listings
SET category = CASE 
  WHEN category ILIKE '%technology%' OR category ILIKE '%tech%' OR category ILIKE '%online%' THEN 'Technology'
  WHEN category ILIKE '%healthcare%' OR category ILIKE '%health%' THEN 'Healthcare'
  WHEN category ILIKE '%financial%' OR category ILIKE '%finance%' THEN 'Finance & Insurance'
  WHEN category ILIKE '%manufacturing%' THEN 'Manufacturing'
  WHEN category ILIKE '%retail%' THEN 'Retail & E-commerce'
  WHEN category ILIKE '%real estate%' OR category ILIKE '%realestate%' THEN 'Real Estate'
  WHEN category ILIKE '%restaurant%' OR category ILIKE '%food%' THEN 'Food & Beverage'
  WHEN category ILIKE '%professional%' THEN 'Professional Services'
  WHEN category ILIKE '%construction%' OR category ILIKE '%building%' THEN 'Construction'
  WHEN category ILIKE '%transportation%' OR category ILIKE '%logistics%' THEN 'Transportation & Logistics'
  WHEN category ILIKE '%energy%' OR category ILIKE '%utilities%' THEN 'Energy & Utilities'
  WHEN category ILIKE '%education%' THEN 'Education'
  WHEN category ILIKE '%entertainment%' OR category ILIKE '%media%' THEN 'Entertainment & Media'
  WHEN category ILIKE '%agriculture%' THEN 'Agriculture'
  WHEN category ILIKE '%automotive%' THEN 'Automotive'
  WHEN category ILIKE '%telecommunication%' OR category ILIKE '%communication%' THEN 'Telecommunications'
  WHEN category ILIKE '%aerospace%' OR category ILIKE '%defense%' THEN 'Aerospace & Defense'
  WHEN category ILIKE '%chemical%' THEN 'Chemicals'
  WHEN category ILIKE '%consumer%' THEN 'Consumer Goods'
  ELSE 'Other'
END;