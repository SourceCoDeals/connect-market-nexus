-- Add Google review/rating columns and LinkedIn URL to listings table
-- Used by apify-google-reviews and apify-linkedin-scrape edge functions

-- =============================================================
-- GOOGLE REVIEW COLUMNS
-- =============================================================

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS google_review_count INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_rating DECIMAL(2,1) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_place_id TEXT DEFAULT NULL;

-- Add index for filtering by review count (used in consumer business scoring)
CREATE INDEX IF NOT EXISTS idx_listings_google_review_count
ON public.listings(google_review_count)
WHERE google_review_count IS NOT NULL;

-- Comment the columns for documentation
COMMENT ON COLUMN public.listings.google_review_count IS 'Number of Google reviews, scraped via Apify';
COMMENT ON COLUMN public.listings.google_rating IS 'Google rating (1.0-5.0), scraped via Apify';
COMMENT ON COLUMN public.listings.google_maps_url IS 'Direct URL to Google Maps listing';
COMMENT ON COLUMN public.listings.google_place_id IS 'Google Place ID for API lookups';

-- =============================================================
-- LINKEDIN URL COLUMN
-- =============================================================

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT NULL;

-- Add index for finding listings with LinkedIn URLs
CREATE INDEX IF NOT EXISTS idx_listings_linkedin_url
ON public.listings(linkedin_url)
WHERE linkedin_url IS NOT NULL;

COMMENT ON COLUMN public.listings.linkedin_url IS 'LinkedIn company page URL, extracted from website or manually entered';
