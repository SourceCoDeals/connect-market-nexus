
-- Fix remaining full state names in geographic_footprint
UPDATE remarketing_buyers 
SET geographic_footprint = ARRAY(
  SELECT CASE 
    WHEN length(elem) = 2 THEN upper(elem)
    WHEN lower(elem) = 'alabama' THEN 'AL'
    WHEN lower(elem) = 'alaska' THEN 'AK'
    WHEN lower(elem) = 'arizona' THEN 'AZ'
    WHEN lower(elem) = 'arkansas' THEN 'AR'
    WHEN lower(elem) = 'california' THEN 'CA'
    WHEN lower(elem) = 'colorado' THEN 'CO'
    WHEN lower(elem) = 'connecticut' THEN 'CT'
    WHEN lower(elem) = 'delaware' THEN 'DE'
    WHEN lower(elem) = 'florida' THEN 'FL'
    WHEN lower(elem) = 'georgia' THEN 'GA'
    WHEN lower(elem) = 'hawaii' THEN 'HI'
    WHEN lower(elem) = 'idaho' THEN 'ID'
    WHEN lower(elem) = 'illinois' THEN 'IL'
    WHEN lower(elem) = 'indiana' THEN 'IN'
    WHEN lower(elem) = 'iowa' THEN 'IA'
    WHEN lower(elem) = 'kansas' THEN 'KS'
    WHEN lower(elem) = 'kentucky' THEN 'KY'
    WHEN lower(elem) = 'louisiana' THEN 'LA'
    WHEN lower(elem) = 'maine' THEN 'ME'
    WHEN lower(elem) = 'maryland' THEN 'MD'
    WHEN lower(elem) = 'massachusetts' THEN 'MA'
    WHEN lower(elem) = 'michigan' THEN 'MI'
    WHEN lower(elem) = 'minnesota' THEN 'MN'
    WHEN lower(elem) = 'mississippi' THEN 'MS'
    WHEN lower(elem) = 'missouri' THEN 'MO'
    WHEN lower(elem) = 'montana' THEN 'MT'
    WHEN lower(elem) = 'nebraska' THEN 'NE'
    WHEN lower(elem) = 'nevada' THEN 'NV'
    WHEN lower(elem) = 'new hampshire' THEN 'NH'
    WHEN lower(elem) = 'new jersey' THEN 'NJ'
    WHEN lower(elem) = 'new mexico' THEN 'NM'
    WHEN lower(elem) = 'new york' THEN 'NY'
    WHEN lower(elem) = 'north carolina' THEN 'NC'
    WHEN lower(elem) = 'north dakota' THEN 'ND'
    WHEN lower(elem) = 'ohio' THEN 'OH'
    WHEN lower(elem) = 'oklahoma' THEN 'OK'
    WHEN lower(elem) = 'oregon' THEN 'OR'
    WHEN lower(elem) = 'pennsylvania' THEN 'PA'
    WHEN lower(elem) = 'rhode island' THEN 'RI'
    WHEN lower(elem) = 'south carolina' THEN 'SC'
    WHEN lower(elem) = 'south dakota' THEN 'SD'
    WHEN lower(elem) = 'tennessee' THEN 'TN'
    WHEN lower(elem) = 'texas' THEN 'TX'
    WHEN lower(elem) = 'utah' THEN 'UT'
    WHEN lower(elem) = 'vermont' THEN 'VT'
    WHEN lower(elem) = 'virginia' THEN 'VA'
    WHEN lower(elem) = 'washington' THEN 'WA'
    WHEN lower(elem) = 'west virginia' THEN 'WV'
    WHEN lower(elem) = 'wisconsin' THEN 'WI'
    WHEN lower(elem) = 'wyoming' THEN 'WY'
    ELSE upper(elem)
  END
  FROM unnest(geographic_footprint) AS elem
)
WHERE geographic_footprint IS NOT NULL 
  AND array_length(geographic_footprint, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(geographic_footprint) AS f WHERE length(f) > 2
  );

-- Also fix hq_city that was incorrectly set to region names
UPDATE remarketing_buyers
SET hq_city = NULL
WHERE hq_city IN ('West Coast', 'East Coast', 'Midwest', 'Southeast', 'Southwest', 'Northeast', 'Northwest', 'National', 'Nationwide');
