-- Add missing columns to user_initial_session table for complete attribution tracking

-- GA4 client ID for data stitching
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS ga4_client_id TEXT;

-- Additional UTM parameters
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Geo columns (separate from location jsonb for easier querying)
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.user_initial_session ADD COLUMN IF NOT EXISTS region TEXT;

-- Create index for GA4 stitching if not exists
CREATE INDEX IF NOT EXISTS idx_user_initial_session_ga4 ON public.user_initial_session(ga4_client_id) WHERE ga4_client_id IS NOT NULL;