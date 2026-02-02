-- Phase 1: Add attribution columns to profiles and user_journeys tables

-- Add first-touch attribution columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_external_referrer text,
ADD COLUMN IF NOT EXISTS first_blog_landing text,
ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS first_utm_source text;

-- Add cross-domain attribution columns to user_journeys table
ALTER TABLE public.user_journeys
ADD COLUMN IF NOT EXISTS first_external_referrer text,
ADD COLUMN IF NOT EXISTS first_blog_landing text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.first_external_referrer IS 'Original external referrer from cross-domain tracking (e.g., www.google.com)';
COMMENT ON COLUMN public.profiles.first_blog_landing IS 'First blog page visited from cross-domain tracking (e.g., /blog/best-m-a-news)';
COMMENT ON COLUMN public.profiles.first_seen_at IS 'Timestamp of first discovery from user_journeys';
COMMENT ON COLUMN public.profiles.first_utm_source IS 'First-touch UTM source for campaign attribution';

COMMENT ON COLUMN public.user_journeys.first_external_referrer IS 'Cross-domain referrer captured from blog tracking script';
COMMENT ON COLUMN public.user_journeys.first_blog_landing IS 'Blog landing page from cross-domain tracking';