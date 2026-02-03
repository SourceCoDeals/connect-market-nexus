-- Add Google review columns to listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS google_review_count INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_rating DECIMAL(2,1) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_place_id TEXT DEFAULT NULL;

-- Add LinkedIn URL column (if not exists)
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_google_review_count
ON public.listings(google_review_count)
WHERE google_review_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_linkedin_url
ON public.listings(linkedin_url)
WHERE linkedin_url IS NOT NULL;

-- Create cron job logs table for monitoring enrichment processing
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name 
ON public.cron_job_logs(job_name, created_at DESC);

-- Grant access to authenticated users for logs
GRANT SELECT ON public.cron_job_logs TO authenticated;