-- Update the adambhaile00@gmail.com profile with missing financial data
UPDATE profiles 
SET 
  target_deal_size_min = 1000000,
  target_deal_size_max = 10000000,
  geographic_focus = '["Midwest US", "Northeast US"]'::jsonb,
  industry_expertise = '["Healthcare & Medical", "Technology & Software"]'::jsonb,
  deal_structure_preference = 'Asset Purchase'
WHERE email = 'adambhaile00@gmail.com';

-- Standardize existing category data
UPDATE listings 
SET category = CASE 
  WHEN category = 'Healthcare' THEN 'Healthcare & Medical'
  WHEN category = 'Manufacturing' THEN 'Manufacturing & Industrial'
  WHEN category = 'Technology' THEN 'Technology & Software'
  ELSE category
END
WHERE category IN ('Healthcare', 'Manufacturing', 'Technology');

-- Standardize existing location data  
UPDATE listings 
SET location = CASE 
  WHEN location = 'Midwest' THEN 'Midwest US'
  WHEN location = 'Northeast' THEN 'Northeast US'
  WHEN location = 'Southwest' THEN 'Southwest US'
  WHEN location = 'Southeast' THEN 'Southeast US'
  WHEN location = 'West Coast' THEN 'West Coast US'
  ELSE location
END
WHERE location IN ('Midwest', 'Northeast', 'Southwest', 'Southeast', 'West Coast');