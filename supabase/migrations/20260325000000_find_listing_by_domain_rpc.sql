-- ============================================================================
-- RPC: find_listing_by_normalized_domain
-- ============================================================================
-- Used by CSV import merge logic to reliably find an existing listing by
-- website domain, even when the stored URL format differs from the CSV value.
-- Uses the same normalize_domain() function as the unique index
-- (idx_listings_unique_website) to guarantee consistent matching.
-- ============================================================================

CREATE OR REPLACE FUNCTION find_listing_by_normalized_domain(target_domain text)
RETURNS SETOF listings
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM listings
  WHERE normalize_domain(website) = normalize_domain(target_domain)
    AND website IS NOT NULL
    AND website != ''
    AND website != '<UNKNOWN>'
  LIMIT 1;
$$;
