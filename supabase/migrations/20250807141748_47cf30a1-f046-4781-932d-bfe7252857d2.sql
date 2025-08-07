-- Phase 1: Data Migration & Cleanup for Standardized Categories

-- Create function to standardize category names
CREATE OR REPLACE FUNCTION standardize_category_name(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE 
    WHEN LOWER(category_name) IN ('business services', 'hr services', 'consulting services') THEN
      RETURN 'Professional Services'
    WHEN LOWER(category_name) IN ('other', 'misc', 'miscellaneous') THEN
      RETURN 'Other'
    WHEN LOWER(category_name) = 'retail' THEN
      RETURN 'Retail'
    WHEN LOWER(category_name) IN ('technology', 'tech', 'software') THEN
      RETURN 'Technology'
    WHEN LOWER(category_name) IN ('healthcare', 'health') THEN
      RETURN 'Healthcare'
    WHEN LOWER(category_name) IN ('manufacturing', 'industrial') THEN
      RETURN 'Manufacturing'
    WHEN LOWER(category_name) IN ('real estate', 'realestate') THEN
      RETURN 'Real Estate'
    WHEN LOWER(category_name) IN ('food & beverage', 'food and beverage', 'restaurant', 'hospitality') THEN
      RETURN 'Food & Beverage'
    WHEN LOWER(category_name) IN ('automotive', 'auto') THEN
      RETURN 'Automotive'
    WHEN LOWER(category_name) IN ('construction', 'building') THEN
      RETURN 'Construction'
    WHEN LOWER(category_name) IN ('financial services', 'finance') THEN
      RETURN 'Financial Services'
    WHEN LOWER(category_name) IN ('education', 'training') THEN
      RETURN 'Education'
    WHEN LOWER(category_name) IN ('entertainment', 'media') THEN
      RETURN 'Entertainment'
    WHEN LOWER(category_name) IN ('transportation', 'logistics') THEN
      RETURN 'Transportation'
    WHEN LOWER(category_name) IN ('energy', 'utilities') THEN
      RETURN 'Energy'
    ELSE
      RETURN category_name -- Keep original if no match
  END;
END;
$$ LANGUAGE plpgsql;

-- Update listings categories to use standardized names
UPDATE listings 
SET category = standardize_category_name(category)
WHERE category IS NOT NULL;

-- Update categories array in listings (if using array format)
UPDATE listings 
SET categories = ARRAY(
  SELECT standardize_category_name(unnest(categories))
)
WHERE categories IS NOT NULL AND array_length(categories, 1) > 0;

-- Ensure target_locations in profiles is properly formatted as array
UPDATE profiles 
SET target_locations = CASE 
  WHEN target_locations IS NULL THEN NULL
  WHEN target_locations = '' THEN NULL
  WHEN target_locations LIKE '[%]' THEN target_locations -- Already JSON array
  ELSE '["' || REPLACE(target_locations, ',', '","') || '"]' -- Convert comma-separated to JSON array
END
WHERE target_locations IS NOT NULL;

-- Update business_categories in profiles to use standardized names
UPDATE profiles 
SET business_categories = (
  SELECT jsonb_agg(standardize_category_name(category))
  FROM jsonb_array_elements_text(business_categories) AS category
)
WHERE business_categories IS NOT NULL AND jsonb_array_length(business_categories) > 0;

-- Create index for better performance on category searches
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_categories ON listings USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_profiles_business_categories ON profiles USING GIN(business_categories);