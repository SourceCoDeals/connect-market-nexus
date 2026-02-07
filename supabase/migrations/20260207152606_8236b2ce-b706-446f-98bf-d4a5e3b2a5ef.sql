
-- Normalize hq_state: convert full state names to 2-letter codes
UPDATE remarketing_buyers SET hq_state = 
  CASE lower(hq_state)
    WHEN 'alabama' THEN 'AL' WHEN 'alaska' THEN 'AK' WHEN 'arizona' THEN 'AZ' WHEN 'arkansas' THEN 'AR'
    WHEN 'california' THEN 'CA' WHEN 'colorado' THEN 'CO' WHEN 'connecticut' THEN 'CT' WHEN 'delaware' THEN 'DE'
    WHEN 'florida' THEN 'FL' WHEN 'georgia' THEN 'GA' WHEN 'hawaii' THEN 'HI' WHEN 'idaho' THEN 'ID'
    WHEN 'illinois' THEN 'IL' WHEN 'indiana' THEN 'IN' WHEN 'iowa' THEN 'IA' WHEN 'kansas' THEN 'KS'
    WHEN 'kentucky' THEN 'KY' WHEN 'louisiana' THEN 'LA' WHEN 'maine' THEN 'ME' WHEN 'maryland' THEN 'MD'
    WHEN 'massachusetts' THEN 'MA' WHEN 'michigan' THEN 'MI' WHEN 'minnesota' THEN 'MN' WHEN 'mississippi' THEN 'MS'
    WHEN 'missouri' THEN 'MO' WHEN 'montana' THEN 'MT' WHEN 'nebraska' THEN 'NE' WHEN 'nevada' THEN 'NV'
    WHEN 'new hampshire' THEN 'NH' WHEN 'new jersey' THEN 'NJ' WHEN 'new mexico' THEN 'NM' WHEN 'new york' THEN 'NY'
    WHEN 'north carolina' THEN 'NC' WHEN 'north dakota' THEN 'ND' WHEN 'ohio' THEN 'OH' WHEN 'oklahoma' THEN 'OK'
    WHEN 'oregon' THEN 'OR' WHEN 'pennsylvania' THEN 'PA' WHEN 'rhode island' THEN 'RI' WHEN 'south carolina' THEN 'SC'
    WHEN 'south dakota' THEN 'SD' WHEN 'tennessee' THEN 'TN' WHEN 'texas' THEN 'TX' WHEN 'utah' THEN 'UT'
    WHEN 'vermont' THEN 'VT' WHEN 'virginia' THEN 'VA' WHEN 'washington' THEN 'WA' WHEN 'west virginia' THEN 'WV'
    WHEN 'wisconsin' THEN 'WI' WHEN 'wyoming' THEN 'WY' WHEN 'district of columbia' THEN 'DC'
    ELSE hq_state
  END
WHERE hq_state IS NOT NULL AND length(hq_state) > 2;

-- Normalize target_geographies: replace full state names with 2-letter codes
-- This uses a helper function to normalize each array element
CREATE OR REPLACE FUNCTION public.normalize_state_name(state_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE lower(trim(state_name))
    WHEN 'alabama' THEN 'AL' WHEN 'alaska' THEN 'AK' WHEN 'arizona' THEN 'AZ' WHEN 'arkansas' THEN 'AR'
    WHEN 'california' THEN 'CA' WHEN 'colorado' THEN 'CO' WHEN 'connecticut' THEN 'CT' WHEN 'delaware' THEN 'DE'
    WHEN 'florida' THEN 'FL' WHEN 'georgia' THEN 'GA' WHEN 'hawaii' THEN 'HI' WHEN 'idaho' THEN 'ID'
    WHEN 'illinois' THEN 'IL' WHEN 'indiana' THEN 'IN' WHEN 'iowa' THEN 'IA' WHEN 'kansas' THEN 'KS'
    WHEN 'kentucky' THEN 'KY' WHEN 'louisiana' THEN 'LA' WHEN 'maine' THEN 'ME' WHEN 'maryland' THEN 'MD'
    WHEN 'massachusetts' THEN 'MA' WHEN 'michigan' THEN 'MI' WHEN 'minnesota' THEN 'MN' WHEN 'mississippi' THEN 'MS'
    WHEN 'missouri' THEN 'MO' WHEN 'montana' THEN 'MT' WHEN 'nebraska' THEN 'NE' WHEN 'nevada' THEN 'NV'
    WHEN 'new hampshire' THEN 'NH' WHEN 'new jersey' THEN 'NJ' WHEN 'new mexico' THEN 'NM' WHEN 'new york' THEN 'NY'
    WHEN 'north carolina' THEN 'NC' WHEN 'north dakota' THEN 'ND' WHEN 'ohio' THEN 'OH' WHEN 'oklahoma' THEN 'OK'
    WHEN 'oregon' THEN 'OR' WHEN 'pennsylvania' THEN 'PA' WHEN 'rhode island' THEN 'RI' WHEN 'south carolina' THEN 'SC'
    WHEN 'south dakota' THEN 'SD' WHEN 'tennessee' THEN 'TN' WHEN 'texas' THEN 'TX' WHEN 'utah' THEN 'UT'
    WHEN 'vermont' THEN 'VT' WHEN 'virginia' THEN 'VA' WHEN 'washington' THEN 'WA' WHEN 'west virginia' THEN 'WV'
    WHEN 'wisconsin' THEN 'WI' WHEN 'wyoming' THEN 'WY' WHEN 'district of columbia' THEN 'DC'
    ELSE upper(trim(state_name))
  END
$$;

-- Normalize target_geographies array elements
UPDATE remarketing_buyers 
SET target_geographies = (
  SELECT array_agg(DISTINCT public.normalize_state_name(elem))
  FROM unnest(target_geographies) AS elem
  WHERE public.normalize_state_name(elem) ~ '^[A-Z]{2}$'
)
WHERE target_geographies IS NOT NULL AND array_length(target_geographies, 1) > 0
AND EXISTS (
  SELECT 1 FROM unnest(target_geographies) AS elem WHERE length(trim(elem)) > 2
);

-- Also populate geographic_footprint from hq_state for buyers that have hq_state but empty footprint
UPDATE remarketing_buyers
SET geographic_footprint = ARRAY[hq_state]
WHERE hq_state IS NOT NULL AND length(hq_state) = 2
AND (geographic_footprint IS NULL OR array_length(geographic_footprint, 1) IS NULL);
