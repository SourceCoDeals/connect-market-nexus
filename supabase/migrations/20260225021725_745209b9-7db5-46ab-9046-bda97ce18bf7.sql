CREATE OR REPLACE FUNCTION public.find_listing_by_normalized_domain(target_domain text)
RETURNS SETOF listings
LANGUAGE sql STABLE
AS $$
  SELECT * FROM listings
  WHERE normalize_domain(website) = normalize_domain(target_domain)
    AND website IS NOT NULL AND website != '' AND website != '<UNKNOWN>'
  LIMIT 1;
$$;