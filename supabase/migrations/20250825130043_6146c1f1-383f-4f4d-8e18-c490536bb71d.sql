-- Phase 1: Standardize user profile business_categories and target_locations

-- First, update business_categories to use standardized values
UPDATE public.profiles
SET business_categories = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem_text = 'Technology' THEN 'Technology'
      WHEN elem_text = 'Healthcare' THEN 'Healthcare'
      WHEN elem_text = 'Manufacturing' THEN 'Manufacturing'
      WHEN elem_text = 'Retail' THEN 'Retail'
      WHEN elem_text = 'Financial Services' THEN 'Financial Services'
      WHEN elem_text = 'Real Estate' THEN 'Real Estate'
      WHEN elem_text = 'Energy' THEN 'Energy'
      WHEN elem_text = 'Education' THEN 'Education'
      WHEN elem_text = 'Construction' THEN 'Construction'
      WHEN elem_text = 'Transportation' THEN 'Transportation'
      WHEN elem_text = 'Hospitality' THEN 'Hospitality'
      WHEN elem_text = 'Agriculture' THEN 'Agriculture'
      WHEN elem_text = 'Professional Services' THEN 'Professional Services'
      WHEN elem_text = 'Media & Entertainment' THEN 'Media & Entertainment'
      WHEN elem_text = 'Food & Beverage' THEN 'Food & Beverage'
      -- Handle common variations and map them to standardized values
      WHEN elem_text ILIKE '%tech%' OR elem_text ILIKE '%software%' OR elem_text ILIKE '%saas%' THEN 'Technology'
      WHEN elem_text ILIKE '%health%' OR elem_text ILIKE '%medical%' THEN 'Healthcare'
      WHEN elem_text ILIKE '%manuf%' THEN 'Manufacturing'
      WHEN elem_text ILIKE '%retail%' OR elem_text ILIKE '%ecommerce%' THEN 'Retail'
      WHEN elem_text ILIKE '%financial%' OR elem_text ILIKE '%finance%' OR elem_text ILIKE '%bank%' THEN 'Financial Services'
      WHEN elem_text ILIKE '%real estate%' OR elem_text ILIKE '%property%' THEN 'Real Estate'
      WHEN elem_text ILIKE '%energy%' OR elem_text ILIKE '%oil%' OR elem_text ILIKE '%gas%' THEN 'Energy'
      WHEN elem_text ILIKE '%education%' OR elem_text ILIKE '%school%' THEN 'Education'
      WHEN elem_text ILIKE '%construction%' OR elem_text ILIKE '%building%' THEN 'Construction'
      WHEN elem_text ILIKE '%transport%' OR elem_text ILIKE '%logistics%' THEN 'Transportation'
      WHEN elem_text ILIKE '%hotel%' OR elem_text ILIKE '%restaurant%' OR elem_text ILIKE '%hospitality%' THEN 'Hospitality'
      WHEN elem_text ILIKE '%farm%' OR elem_text ILIKE '%agriculture%' THEN 'Agriculture'
      WHEN elem_text ILIKE '%professional%' OR elem_text ILIKE '%consulting%' THEN 'Professional Services'
      WHEN elem_text ILIKE '%media%' OR elem_text ILIKE '%entertainment%' THEN 'Media & Entertainment'
      WHEN elem_text ILIKE '%food%' OR elem_text ILIKE '%beverage%' THEN 'Food & Beverage'
      -- Default to Technology for unmapped categories as it's the most common
      ELSE 'Technology'
    END
  )
  FROM jsonb_array_elements_text(business_categories) AS elem_text
  WHERE elem_text IS NOT NULL AND trim(elem_text) != ''
)
WHERE business_categories IS NOT NULL 
  AND jsonb_typeof(business_categories) = 'array'
  AND jsonb_array_length(business_categories) > 0;

-- Update target_locations to use standardized values
UPDATE public.profiles
SET target_locations = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem_text = 'United States' THEN 'United States'
      WHEN elem_text = 'Canada' THEN 'Canada'
      WHEN elem_text = 'United Kingdom' THEN 'United Kingdom'
      WHEN elem_text = 'Germany' THEN 'Germany'
      WHEN elem_text = 'France' THEN 'France'
      WHEN elem_text = 'Australia' THEN 'Australia'
      WHEN elem_text = 'Japan' THEN 'Japan'
      WHEN elem_text = 'Singapore' THEN 'Singapore'
      WHEN elem_text = 'Switzerland' THEN 'Switzerland'
      WHEN elem_text = 'Netherlands' THEN 'Netherlands'
      -- Handle common variations and map them to standardized values
      WHEN elem_text ILIKE '%united states%' OR elem_text ILIKE '%usa%' OR elem_text ILIKE '%america%' THEN 'United States'
      WHEN elem_text ILIKE '%canada%' THEN 'Canada'
      WHEN elem_text ILIKE '%united kingdom%' OR elem_text ILIKE '%uk%' OR elem_text ILIKE '%britain%' THEN 'United Kingdom'
      WHEN elem_text ILIKE '%germany%' OR elem_text ILIKE '%deutschland%' THEN 'Germany'
      WHEN elem_text ILIKE '%france%' THEN 'France'
      WHEN elem_text ILIKE '%australia%' THEN 'Australia'
      WHEN elem_text ILIKE '%japan%' THEN 'Japan'
      WHEN elem_text ILIKE '%singapore%' THEN 'Singapore'
      WHEN elem_text ILIKE '%switzerland%' THEN 'Switzerland'
      WHEN elem_text ILIKE '%netherlands%' OR elem_text ILIKE '%holland%' THEN 'Netherlands'
      -- Default to United States for unmapped locations as it's the most common
      ELSE 'United States'
    END
  )
  FROM jsonb_array_elements_text(target_locations) AS elem_text
  WHERE elem_text IS NOT NULL AND trim(elem_text) != ''
)
WHERE target_locations IS NOT NULL 
  AND jsonb_typeof(target_locations) = 'array'
  AND jsonb_array_length(target_locations) > 0;

-- Clean up empty arrays and null values
UPDATE public.profiles
SET business_categories = '[]'::jsonb
WHERE business_categories IS NULL 
   OR jsonb_typeof(business_categories) != 'array'
   OR jsonb_array_length(business_categories) = 0;

UPDATE public.profiles
SET target_locations = '[]'::jsonb
WHERE target_locations IS NULL 
   OR jsonb_typeof(target_locations) != 'array'
   OR jsonb_array_length(target_locations) = 0;