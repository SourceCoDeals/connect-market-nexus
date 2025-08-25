-- Phase 2: Update deal alerts criteria to use standardized values and improve matching function

-- First, standardize existing deal alert criteria
UPDATE public.deal_alerts
SET criteria = jsonb_set(
  jsonb_set(
    criteria,
    '{categories}',
    CASE 
      WHEN criteria->>'category' IS NOT NULL AND criteria->>'category' != '' THEN
        jsonb_build_array(
          CASE 
            WHEN criteria->>'category' = 'Technology' THEN 'Technology'
            WHEN criteria->>'category' = 'Healthcare' THEN 'Healthcare'
            WHEN criteria->>'category' = 'Manufacturing' THEN 'Manufacturing'
            WHEN criteria->>'category' = 'Retail' THEN 'Retail'
            WHEN criteria->>'category' = 'Financial Services' THEN 'Financial Services'
            WHEN criteria->>'category' = 'Real Estate' THEN 'Real Estate'
            WHEN criteria->>'category' = 'Energy' THEN 'Energy'
            WHEN criteria->>'category' = 'Education' THEN 'Education'
            WHEN criteria->>'category' = 'Construction' THEN 'Construction'
            WHEN criteria->>'category' = 'Transportation' THEN 'Transportation'
            WHEN criteria->>'category' = 'Hospitality' THEN 'Hospitality'
            WHEN criteria->>'category' = 'Agriculture' THEN 'Agriculture'
            WHEN criteria->>'category' = 'Professional Services' THEN 'Professional Services'
            WHEN criteria->>'category' = 'Media & Entertainment' THEN 'Media & Entertainment'
            WHEN criteria->>'category' = 'Food & Beverage' THEN 'Food & Beverage'
            -- Handle variations
            WHEN criteria->>'category' ILIKE '%tech%' OR criteria->>'category' ILIKE '%software%' THEN 'Technology'
            WHEN criteria->>'category' ILIKE '%health%' THEN 'Healthcare'
            ELSE 'Technology'
          END
        )
      WHEN criteria ? 'categories' AND jsonb_typeof(criteria->'categories') = 'array' THEN criteria->'categories'
      ELSE '[]'::jsonb
    END
  ),
  '{locations}',
  CASE 
    WHEN criteria->>'location' IS NOT NULL AND criteria->>'location' != '' THEN
      jsonb_build_array(
        CASE 
          WHEN criteria->>'location' = 'United States' THEN 'United States'
          WHEN criteria->>'location' = 'Canada' THEN 'Canada'
          WHEN criteria->>'location' = 'United Kingdom' THEN 'United Kingdom'
          WHEN criteria->>'location' = 'Germany' THEN 'Germany'
          WHEN criteria->>'location' = 'France' THEN 'France'
          WHEN criteria->>'location' = 'Australia' THEN 'Australia'
          WHEN criteria->>'location' = 'Japan' THEN 'Japan'
          WHEN criteria->>'location' = 'Singapore' THEN 'Singapore'
          WHEN criteria->>'location' = 'Switzerland' THEN 'Switzerland'
          WHEN criteria->>'location' = 'Netherlands' THEN 'Netherlands'
          -- Handle variations
          WHEN criteria->>'location' ILIKE '%united states%' OR criteria->>'location' ILIKE '%usa%' THEN 'United States'
          WHEN criteria->>'location' ILIKE '%canada%' THEN 'Canada'
          WHEN criteria->>'location' ILIKE '%uk%' OR criteria->>'location' ILIKE '%britain%' THEN 'United Kingdom'
          ELSE 'United States'
        END
      )
    WHEN criteria ? 'locations' AND jsonb_typeof(criteria->'locations') = 'array' THEN criteria->'locations'
    ELSE '[]'::jsonb
  END
)
WHERE criteria IS NOT NULL;

-- Update the match_deal_alerts_with_listing function to handle both old and new formats with standardization
CREATE OR REPLACE FUNCTION public.match_deal_alerts_with_listing(listing_data jsonb)
RETURNS TABLE(alert_id uuid, user_id uuid, user_email text, alert_name text, alert_frequency text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  listing_categories text[];
  listing_location text;
  listing_category text;
BEGIN
  -- Extract listing data
  listing_category := listing_data->>'category';
  listing_location := listing_data->>'location';
  
  -- Build comprehensive categories array from both single category and categories array
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      ARRAY[listing_category] || 
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(listing_data->'categories')), 
        '{}'::text[]
      )
    )
    WHERE unnest IS NOT NULL AND trim(unnest) != ''
  ) INTO listing_categories;

  RETURN QUERY
  SELECT 
    da.id as alert_id,
    da.user_id,
    p.email as user_email,
    da.name as alert_name,
    da.frequency as alert_frequency
  FROM public.deal_alerts da
  JOIN public.profiles p ON da.user_id = p.id
  WHERE da.is_active = true
    AND p.approval_status = 'approved'
    AND p.email_verified = true
    AND (
      -- Match categories (check both old 'category' field and new 'categories' array)
      (
        -- No category filter set
        (da.criteria->>'category' IS NULL OR da.criteria->>'category' = '') 
        AND (da.criteria->'categories' IS NULL OR jsonb_array_length(da.criteria->'categories') = 0)
      )
      OR
      (
        -- Old single category field matches any listing category
        da.criteria->>'category' IS NOT NULL 
        AND da.criteria->>'category' != ''
        AND da.criteria->>'category' = ANY(listing_categories)
      )
      OR
      (
        -- New categories array has overlap with listing categories
        da.criteria->'categories' IS NOT NULL 
        AND jsonb_typeof(da.criteria->'categories') = 'array'
        AND jsonb_array_length(da.criteria->'categories') > 0
        AND EXISTS (
          SELECT 1 
          FROM jsonb_array_elements_text(da.criteria->'categories') alert_cat
          WHERE alert_cat = ANY(listing_categories)
        )
      )
    )
    AND (
      -- Match location (check both old 'location' field and new 'locations' array)
      (
        -- No location filter set
        (da.criteria->>'location' IS NULL OR da.criteria->>'location' = '')
        AND (da.criteria->'locations' IS NULL OR jsonb_array_length(da.criteria->'locations') = 0)
      )
      OR
      (
        -- Old single location field matches
        da.criteria->>'location' IS NOT NULL 
        AND da.criteria->>'location' != ''
        AND da.criteria->>'location' = listing_location
      )
      OR
      (
        -- New locations array contains listing location
        da.criteria->'locations' IS NOT NULL 
        AND jsonb_typeof(da.criteria->'locations') = 'array'
        AND jsonb_array_length(da.criteria->'locations') > 0
        AND listing_location = ANY(
          ARRAY(SELECT jsonb_array_elements_text(da.criteria->'locations'))
        )
      )
    )
    AND (
      -- Match revenue range
      (da.criteria->>'revenueMin' IS NULL OR (listing_data->>'revenue')::numeric >= (da.criteria->>'revenueMin')::numeric)
      AND
      (da.criteria->>'revenueMax' IS NULL OR (listing_data->>'revenue')::numeric <= (da.criteria->>'revenueMax')::numeric)
    )
    AND (
      -- Match EBITDA range
      (da.criteria->>'ebitdaMin' IS NULL OR (listing_data->>'ebitda')::numeric >= (da.criteria->>'ebitdaMin')::numeric)
      AND
      (da.criteria->>'ebitdaMax' IS NULL OR (listing_data->>'ebitda')::numeric <= (da.criteria->>'ebitdaMax')::numeric)
    )
    AND (
      -- Match search term (if provided)
      (da.criteria->>'search' IS NULL OR da.criteria->>'search' = '' OR 
       (listing_data->>'title' ILIKE '%' || (da.criteria->>'search') || '%' OR 
        listing_data->>'description' ILIKE '%' || (da.criteria->>'search') || '%'))
    );
END;
$$;