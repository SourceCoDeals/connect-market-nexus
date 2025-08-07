-- Convert existing free-text target_locations to standardized comma-separated values
UPDATE public.profiles 
SET target_locations = CASE 
  WHEN target_locations ILIKE '%northeast%' AND target_locations ILIKE '%southeast%' THEN 'Northeast,Southeast'
  WHEN target_locations ILIKE '%southwest%' AND target_locations ILIKE '%southeast%' THEN 'Southwest,Southeast'
  WHEN target_locations ILIKE '%west%' AND target_locations ILIKE '%southwest%' THEN 'West,Southwest'
  WHEN target_locations ILIKE '%northeast%' THEN 'Northeast'
  WHEN target_locations ILIKE '%southeast%' THEN 'Southeast'
  WHEN target_locations ILIKE '%southwest%' THEN 'Southwest'
  WHEN target_locations ILIKE '%northwest%' THEN 'Northwest'
  WHEN target_locations ILIKE '%midwest%' THEN 'Midwest'
  WHEN target_locations ILIKE '%great lakes%' THEN 'Great Lakes'
  WHEN target_locations ILIKE '%mountain%' THEN 'Mountain'
  WHEN target_locations ILIKE '%pacific%' THEN 'Pacific'
  WHEN target_locations ILIKE '%california%' THEN 'California'
  WHEN target_locations ILIKE '%texas%' THEN 'Texas'
  WHEN target_locations ILIKE '%florida%' THEN 'Florida'
  WHEN target_locations ILIKE '%new york%' THEN 'New York'
  WHEN target_locations ILIKE '%national%' OR target_locations ILIKE '%usa%' OR target_locations ILIKE '%united states%' THEN 'National'
  WHEN target_locations ILIKE '%international%' THEN 'International'
  ELSE 'National'  -- Default for any unmatched text
END
WHERE target_locations IS NOT NULL 
  AND target_locations != ''
  AND target_locations NOT IN (
    'Northeast', 'Southeast', 'Southwest', 'Northwest', 'Midwest', 
    'Great Lakes', 'Mountain', 'Pacific', 'California', 'Texas', 
    'Florida', 'New York', 'National', 'International'
  );

-- Ensure all listings use standardized locations
UPDATE public.listings 
SET location = CASE 
  WHEN location ILIKE '%northeast%' THEN 'Northeast'
  WHEN location ILIKE '%southeast%' THEN 'Southeast'
  WHEN location ILIKE '%southwest%' THEN 'Southwest'
  WHEN location ILIKE '%northwest%' THEN 'Northwest'
  WHEN location ILIKE '%midwest%' THEN 'Midwest'
  WHEN location ILIKE '%great lakes%' THEN 'Great Lakes'
  WHEN location ILIKE '%mountain%' THEN 'Mountain'
  WHEN location ILIKE '%pacific%' THEN 'Pacific'
  WHEN location ILIKE '%california%' THEN 'California'
  WHEN location ILIKE '%texas%' THEN 'Texas'
  WHEN location ILIKE '%florida%' THEN 'Florida'
  WHEN location ILIKE '%new york%' THEN 'New York'
  WHEN location ILIKE '%national%' OR location ILIKE '%usa%' THEN 'National'
  WHEN location ILIKE '%international%' THEN 'International'
  ELSE 'National'  -- Default for any unmatched text
END
WHERE location NOT IN (
  'Northeast', 'Southeast', 'Southwest', 'Northwest', 'Midwest', 
  'Great Lakes', 'Mountain', 'Pacific', 'California', 'Texas', 
  'Florida', 'New York', 'National', 'International'
);