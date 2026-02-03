-- Add bot detection and geolocation coordinate columns to user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;

-- Create index for filtering out bots in queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_bot ON public.user_sessions(is_bot) WHERE is_bot = false;

-- Backfill: Mark existing sessions with known bot signatures as bots
UPDATE public.user_sessions 
SET is_bot = true 
WHERE 
  -- Outdated Chrome version (Chrome 119 is from Nov 2023, 2+ years old)
  user_agent ILIKE '%Chrome/119.0%'
  OR user_agent ILIKE '%Chrome/118.0%'
  OR user_agent ILIKE '%Chrome/117.0%'
  -- Headless browser indicators
  OR user_agent ILIKE '%HeadlessChrome%'
  -- Known crawler/bot strings
  OR user_agent ILIKE '%GoogleOther%'
  OR user_agent ILIKE '%Googlebot%'
  OR user_agent ILIKE '%bingbot%'
  OR user_agent ILIKE '%Baiduspider%'
  OR user_agent ILIKE '%YandexBot%'
  OR user_agent ILIKE '%DuckDuckBot%'
  OR user_agent ILIKE '%Slackbot%'
  OR user_agent ILIKE '%Twitterbot%'
  OR user_agent ILIKE '%facebookexternalhit%'
  OR user_agent ILIKE '%LinkedInBot%'
  OR user_agent ILIKE '%bot%'
  OR user_agent ILIKE '%crawler%'
  OR user_agent ILIKE '%spider%';