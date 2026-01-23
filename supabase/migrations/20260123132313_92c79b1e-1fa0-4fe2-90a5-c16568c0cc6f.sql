-- Add enrichment tracking and additional info fields to listings table
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS key_risks TEXT,
ADD COLUMN IF NOT EXISTS competitive_position TEXT,
ADD COLUMN IF NOT EXISTS technology_systems TEXT,
ADD COLUMN IF NOT EXISTS real_estate_info TEXT,
ADD COLUMN IF NOT EXISTS growth_trajectory TEXT;

-- Add index for enriched_at to efficiently query enriched deals
CREATE INDEX IF NOT EXISTS idx_listings_enriched_at ON public.listings(enriched_at) WHERE enriched_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.listings.enriched_at IS 'Timestamp when the deal was enriched via AI';
COMMENT ON COLUMN public.listings.key_risks IS 'Key risk factors identified for the deal';
COMMENT ON COLUMN public.listings.competitive_position IS 'Market positioning and competitive landscape';
COMMENT ON COLUMN public.listings.technology_systems IS 'Technology and systems used by the company';
COMMENT ON COLUMN public.listings.real_estate_info IS 'Real estate details (owned vs leased)';
COMMENT ON COLUMN public.listings.growth_trajectory IS 'Historical and projected growth trajectory';