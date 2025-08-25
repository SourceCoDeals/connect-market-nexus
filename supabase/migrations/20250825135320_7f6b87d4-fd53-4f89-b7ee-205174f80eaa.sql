-- Update deal alerts function to support location hierarchy

CREATE OR REPLACE FUNCTION public.match_deal_alerts_with_listing(listing_data jsonb)
 RETURNS TABLE(alert_id uuid, user_id uuid, user_email text, alert_name text, alert_frequency text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  listing_categories text[];
  listing_location text;
  listing_category text;
  expanded_alert_locations text[];
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
      -- Enhanced location matching with hierarchy support
      (
        -- No location filter set
        (da.criteria->>'location' IS NULL OR da.criteria->>'location' = '')
        AND (da.criteria->'locations' IS NULL OR jsonb_array_length(da.criteria->'locations') = 0)
      )
      OR
      (
        -- Old single location field with hierarchy matching
        da.criteria->>'location' IS NOT NULL 
        AND da.criteria->>'location' != ''
        AND (
          da.criteria->>'location' = listing_location
          OR 
          -- North America includes all US regions and Canada
          (da.criteria->>'location' = 'North America' AND listing_location IN ('United States', 'Canada', 'Northeast US', 'Southeast US', 'Midwest US', 'Southwest US', 'Western US'))
          OR
          -- United States includes all US regions
          (da.criteria->>'location' = 'United States' AND listing_location IN ('Northeast US', 'Southeast US', 'Midwest US', 'Southwest US', 'Western US'))
          OR
          -- Europe includes United Kingdom
          (da.criteria->>'location' = 'Europe' AND listing_location = 'United Kingdom')
          OR
          -- Global/International includes everything
          (da.criteria->>'location' = 'Global/International')
        )
      )
      OR
      (
        -- New locations array with hierarchy matching
        da.criteria->'locations' IS NOT NULL 
        AND jsonb_typeof(da.criteria->'locations') = 'array'
        AND jsonb_array_length(da.criteria->'locations') > 0
        AND (
          -- Direct match
          listing_location = ANY(ARRAY(SELECT jsonb_array_elements_text(da.criteria->'locations')))
          OR
          -- Hierarchy matches
          EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(da.criteria->'locations') alert_loc
            WHERE (
              -- North America includes all US regions and Canada
              (alert_loc = 'North America' AND listing_location IN ('United States', 'Canada', 'Northeast US', 'Southeast US', 'Midwest US', 'Southwest US', 'Western US'))
              OR
              -- United States includes all US regions
              (alert_loc = 'United States' AND listing_location IN ('Northeast US', 'Southeast US', 'Midwest US', 'Southwest US', 'Western US'))
              OR
              -- Europe includes United Kingdom
              (alert_loc = 'Europe' AND listing_location = 'United Kingdom')
              OR
              -- Global/International includes everything
              (alert_loc = 'Global/International')
            )
          )
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
$function$;