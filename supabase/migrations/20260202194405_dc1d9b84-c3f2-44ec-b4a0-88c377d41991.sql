-- Backfill existing users' attribution from their first session
-- Priority 1: Use original_external_referrer from first session (cross-domain attribution)
-- Priority 2: Use immediate referrer from first session if no cross-domain data

-- First, backfill users who have cross-domain attribution data
UPDATE public.profiles p
SET 
  first_external_referrer = COALESCE(p.first_external_referrer, us.original_external_referrer),
  first_blog_landing = COALESCE(p.first_blog_landing, us.blog_landing_page),
  first_seen_at = COALESCE(p.first_seen_at, us.started_at)
FROM public.user_sessions us
WHERE us.user_id = p.id
  AND p.first_external_referrer IS NULL
  AND us.original_external_referrer IS NOT NULL
  AND us.started_at = (
    SELECT MIN(started_at) 
    FROM public.user_sessions 
    WHERE user_id = p.id
      AND original_external_referrer IS NOT NULL
  );

-- Second, for users without cross-domain data, use immediate referrer from first session
UPDATE public.profiles p
SET 
  first_external_referrer = COALESCE(p.first_external_referrer, us.referrer),
  first_seen_at = COALESCE(p.first_seen_at, us.started_at)
FROM public.user_sessions us
WHERE us.user_id = p.id
  AND p.first_external_referrer IS NULL
  AND us.referrer IS NOT NULL
  AND us.referrer != ''
  AND us.started_at = (
    SELECT MIN(started_at) 
    FROM public.user_sessions 
    WHERE user_id = p.id
  );

-- Third, set first_seen_at for any remaining users from their earliest session
UPDATE public.profiles p
SET first_seen_at = (
  SELECT MIN(started_at) 
  FROM public.user_sessions 
  WHERE user_id = p.id
)
WHERE p.first_seen_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_sessions WHERE user_id = p.id
  );