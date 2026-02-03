-- Add structured address columns for remarketing accuracy
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'US';

-- Add index for geographic queries
CREATE INDEX IF NOT EXISTS idx_listings_address_state ON listings(address_state);

-- Migrate existing address data where parseable (City, ST format)
UPDATE listings
SET 
  address_city = TRIM(SPLIT_PART(address, ',', 1)),
  address_state = UPPER(TRIM(REGEXP_REPLACE(SPLIT_PART(address, ',', 2), '\s*\d{5}.*', '')))
WHERE address IS NOT NULL
  AND address ~ '^[^,]+,\s*[A-Za-z]{2}'
  AND address_city IS NULL;