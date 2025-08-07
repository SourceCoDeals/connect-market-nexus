-- Final migration to standardize all remaining listing categories
-- Map non-standard categories to standardized STANDARDIZED_CATEGORIES values

-- First, let's see what non-standard categories we have
-- UPDATE listings with proper category mappings

-- Map "Other" and other non-standard categories to appropriate standardized categories
UPDATE public.listings 
SET 
  category = CASE 
    -- Professional services mappings
    WHEN category = 'Other' AND (
      title ILIKE '%benefits%' OR 
      title ILIKE '%administration%' OR 
      title ILIKE '%consultant%' OR
      title ILIKE '%advisory%' OR
      description ILIKE '%benefits%' OR
      description ILIKE '%administration%' OR
      description ILIKE '%consulting%'
    ) THEN 'Professional Services'
    
    -- Technology mappings
    WHEN category = 'Other' AND (
      title ILIKE '%software%' OR 
      title ILIKE '%tech%' OR 
      title ILIKE '%platform%' OR
      title ILIKE '%digital%' OR
      description ILIKE '%software%' OR
      description ILIKE '%technology%' OR
      description ILIKE '%platform%'
    ) THEN 'Technology'
    
    -- Healthcare mappings
    WHEN category = 'Other' AND (
      title ILIKE '%health%' OR 
      title ILIKE '%medical%' OR 
      title ILIKE '%clinic%' OR
      description ILIKE '%health%' OR
      description ILIKE '%medical%'
    ) THEN 'Healthcare'
    
    -- Manufacturing mappings
    WHEN category = 'Other' AND (
      title ILIKE '%manufacturing%' OR 
      title ILIKE '%production%' OR 
      title ILIKE '%industrial%' OR
      description ILIKE '%manufacturing%' OR
      description ILIKE '%production%'
    ) THEN 'Manufacturing'
    
    -- Retail mappings
    WHEN category = 'Other' AND (
      title ILIKE '%retail%' OR 
      title ILIKE '%store%' OR 
      title ILIKE '%shop%' OR
      description ILIKE '%retail%' OR
      description ILIKE '%store%'
    ) THEN 'Retail'
    
    -- Financial Services mappings
    WHEN category = 'Other' AND (
      title ILIKE '%financial%' OR 
      title ILIKE '%finance%' OR 
      title ILIKE '%banking%' OR
      title ILIKE '%investment%' OR
      description ILIKE '%financial%' OR
      description ILIKE '%finance%'
    ) THEN 'Financial Services'
    
    -- Real Estate mappings
    WHEN category = 'Other' AND (
      title ILIKE '%real estate%' OR 
      title ILIKE '%property%' OR 
      title ILIKE '%realty%' OR
      description ILIKE '%real estate%' OR
      description ILIKE '%property%'
    ) THEN 'Real Estate'
    
    -- Education mappings
    WHEN category = 'Other' AND (
      title ILIKE '%education%' OR 
      title ILIKE '%school%' OR 
      title ILIKE '%training%' OR
      description ILIKE '%education%' OR
      description ILIKE '%training%'
    ) THEN 'Education'
    
    -- Hospitality mappings
    WHEN category = 'Other' AND (
      title ILIKE '%restaurant%' OR 
      title ILIKE '%hotel%' OR 
      title ILIKE '%hospitality%' OR
      description ILIKE '%restaurant%' OR
      description ILIKE '%hospitality%'
    ) THEN 'Hospitality'
    
    -- Construction mappings
    WHEN category = 'Other' AND (
      title ILIKE '%construction%' OR 
      title ILIKE '%building%' OR 
      title ILIKE '%contractor%' OR
      description ILIKE '%construction%' OR
      description ILIKE '%building%'
    ) THEN 'Construction'
    
    -- Transportation mappings
    WHEN category = 'Other' AND (
      title ILIKE '%transport%' OR 
      title ILIKE '%logistics%' OR 
      title ILIKE '%shipping%' OR
      description ILIKE '%transport%' OR
      description ILIKE '%logistics%'
    ) THEN 'Transportation'
    
    -- Energy mappings
    WHEN category = 'Other' AND (
      title ILIKE '%energy%' OR 
      title ILIKE '%solar%' OR 
      title ILIKE '%renewable%' OR
      description ILIKE '%energy%' OR
      description ILIKE '%solar%'
    ) THEN 'Energy'
    
    -- Default fallback for remaining "Other" categories
    WHEN category = 'Other' THEN 'Professional Services'
    
    -- Keep existing valid categories as-is
    ELSE category
  END,
  updated_at = NOW()
WHERE 
  category NOT IN (
    'Automotive', 'Technology', 'Healthcare', 'Manufacturing', 'Retail', 
    'Financial Services', 'Real Estate', 'Education', 'Hospitality', 
    'Construction', 'Professional Services', 'Food & Beverage', 
    'Transportation', 'Energy', 'Agriculture', 'Media & Entertainment'
  ) 
  OR category = 'Other';

-- Also update the categories array field if it exists and contains non-standard values
UPDATE public.listings 
SET 
  categories = ARRAY(
    SELECT CASE 
      WHEN unnest_val = 'Other' THEN 'Professional Services'
      WHEN unnest_val NOT IN (
        'Automotive', 'Technology', 'Healthcare', 'Manufacturing', 'Retail', 
        'Financial Services', 'Real Estate', 'Education', 'Hospitality', 
        'Construction', 'Professional Services', 'Food & Beverage', 
        'Transportation', 'Energy', 'Agriculture', 'Media & Entertainment'
      ) THEN 'Professional Services'
      ELSE unnest_val
    END
    FROM unnest(categories) AS unnest_val
    WHERE unnest_val IS NOT NULL AND unnest_val != ''
  ),
  updated_at = NOW()
WHERE 
  categories IS NOT NULL 
  AND array_length(categories, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(categories) AS cat 
    WHERE cat NOT IN (
      'Automotive', 'Technology', 'Healthcare', 'Manufacturing', 'Retail', 
      'Financial Services', 'Real Estate', 'Education', 'Hospitality', 
      'Construction', 'Professional Services', 'Food & Beverage', 
      'Transportation', 'Energy', 'Agriculture', 'Media & Entertainment'
    ) OR cat = 'Other'
  );