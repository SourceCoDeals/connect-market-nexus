-- Standardize existing data in listings and profiles tables

-- Update non-canonical locations in listings
UPDATE public.listings
SET location = CASE 
  WHEN location = 'Midwest' THEN 'Midwest US'
  WHEN location = 'Northeast' THEN 'Northeast US'
  WHEN location = 'Southeast' THEN 'Southeast US'
  WHEN location = 'Southwest' THEN 'Southwest US'
  WHEN location = 'Western' THEN 'Western US'
  WHEN location = 'US' THEN 'United States'
  WHEN location = 'USA' THEN 'United States'
  WHEN location = 'UK' THEN 'United Kingdom'
  ELSE location
END
WHERE location IN ('Midwest', 'Northeast', 'Southeast', 'Southwest', 'Western', 'US', 'USA', 'UK');

-- Update non-canonical categories in listings  
UPDATE public.listings
SET category = CASE
  WHEN category = 'Technology' THEN 'Technology & Software'
  WHEN category = 'Healthcare' THEN 'Healthcare & Medical'
  WHEN category = 'Finance' THEN 'Finance & Insurance'
  WHEN category = 'Food' THEN 'Food & Beverage'
  WHEN category = 'Media' THEN 'Entertainment & Media'
  WHEN category = 'Services' THEN 'Professional Services'
  ELSE category
END
WHERE category IN ('Technology', 'Healthcare', 'Finance', 'Food', 'Media', 'Services');

-- Update adambhaile00@gmail.com profile with correct independent sponsor data
UPDATE public.profiles
SET 
  industry_expertise = COALESCE(
    CASE 
      WHEN industry_expertise IS NOT NULL AND jsonb_typeof(industry_expertise) = 'array' THEN industry_expertise
      ELSE '["Technology & Software", "Healthcare & Medical"]'::jsonb
    END,
    '["Technology & Software", "Healthcare & Medical"]'::jsonb
  ),
  geographic_focus = COALESCE(
    CASE 
      WHEN geographic_focus IS NOT NULL AND jsonb_typeof(geographic_focus) = 'array' THEN geographic_focus
      ELSE '["North America", "United States"]'::jsonb
    END,
    '["North America", "United States"]'::jsonb
  ),
  target_deal_size_min = COALESCE(target_deal_size_min, 1000000),
  target_deal_size_max = COALESCE(target_deal_size_max, 50000000),
  deal_structure_preference = COALESCE(NULLIF(deal_structure_preference, ''), 'Equity Investment'),
  updated_at = NOW()
WHERE email = 'adambhaile00@gmail.com';

-- Standardize existing profile data for other users
UPDATE public.profiles
SET 
  business_categories = CASE
    WHEN business_categories IS NOT NULL AND jsonb_typeof(business_categories) = 'array' THEN 
      (SELECT jsonb_agg(
        CASE 
          WHEN cat = 'Technology' THEN 'Technology & Software'
          WHEN cat = 'Healthcare' THEN 'Healthcare & Medical'
          WHEN cat = 'Finance' THEN 'Finance & Insurance'
          WHEN cat = 'Food' THEN 'Food & Beverage'
          WHEN cat = 'Media' THEN 'Entertainment & Media'
          WHEN cat = 'Services' THEN 'Professional Services'
          ELSE cat
        END
      ) FROM jsonb_array_elements_text(business_categories) AS cat)
    ELSE business_categories
  END,
  target_locations = CASE
    WHEN target_locations IS NOT NULL AND jsonb_typeof(target_locations) = 'array' THEN
      (SELECT jsonb_agg(
        CASE 
          WHEN loc = 'Midwest' THEN 'Midwest US'
          WHEN loc = 'Northeast' THEN 'Northeast US'
          WHEN loc = 'Southeast' THEN 'Southeast US'
          WHEN loc = 'Southwest' THEN 'Southwest US'
          WHEN loc = 'Western' THEN 'Western US'
          WHEN loc = 'US' THEN 'United States'
          WHEN loc = 'USA' THEN 'United States'
          WHEN loc = 'UK' THEN 'United Kingdom'
          ELSE loc
        END
      ) FROM jsonb_array_elements_text(target_locations) AS loc)
    ELSE target_locations
  END,
  updated_at = NOW()
WHERE business_categories IS NOT NULL OR target_locations IS NOT NULL;