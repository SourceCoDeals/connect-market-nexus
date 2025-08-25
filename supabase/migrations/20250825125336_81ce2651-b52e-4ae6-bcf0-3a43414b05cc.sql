-- Backfill standardized array and clean whitespace for listings
UPDATE public.listings
SET categories = ARRAY[category]
WHERE (categories IS NULL OR array_length(categories,1) IS NULL OR array_length(categories,1) = 0)
  AND category IS NOT NULL;

-- Trim whitespace from single fields
UPDATE public.listings
SET category = btrim(category),
    location = btrim(location)
WHERE category IS NOT NULL OR location IS NOT NULL;

-- Trim whitespace from each element in categories array
UPDATE public.listings
SET categories = ARRAY(SELECT btrim(x) FROM unnest(categories) AS x)
WHERE categories IS NOT NULL;
