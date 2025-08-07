-- Phase 1: Simple Data Migration & Cleanup for Standardized Categories

-- Update listings categories to use standardized names
UPDATE listings 
SET category = 
  CASE 
    WHEN LOWER(category) IN ('business services', 'hr services', 'consulting services') THEN 'Professional Services'
    WHEN LOWER(category) IN ('other', 'misc', 'miscellaneous') THEN 'Other'
    WHEN LOWER(category) = 'retail' THEN 'Retail'
    WHEN LOWER(category) IN ('technology', 'tech', 'software') THEN 'Technology'
    WHEN LOWER(category) IN ('healthcare', 'health') THEN 'Healthcare'
    WHEN LOWER(category) IN ('manufacturing', 'industrial') THEN 'Manufacturing'
    WHEN LOWER(category) IN ('real estate', 'realestate') THEN 'Real Estate'
    WHEN LOWER(category) IN ('food & beverage', 'food and beverage', 'restaurant', 'hospitality') THEN 'Food & Beverage'
    WHEN LOWER(category) IN ('automotive', 'auto') THEN 'Automotive'
    WHEN LOWER(category) IN ('construction', 'building') THEN 'Construction'
    WHEN LOWER(category) IN ('financial services', 'finance') THEN 'Financial Services'
    WHEN LOWER(category) IN ('education', 'training') THEN 'Education'
    WHEN LOWER(category) IN ('entertainment', 'media') THEN 'Entertainment'
    WHEN LOWER(category) IN ('transportation', 'logistics') THEN 'Transportation'
    WHEN LOWER(category) IN ('energy', 'utilities') THEN 'Energy'
    ELSE category
  END
WHERE category IS NOT NULL;

-- Create index for better performance on category searches
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_categories ON listings USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_profiles_business_categories ON profiles USING GIN(business_categories);