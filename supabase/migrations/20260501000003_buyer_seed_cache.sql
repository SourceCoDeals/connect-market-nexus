-- Migration D: buyer_seed_cache table
-- Prevents the seeding engine from calling Claude twice for the same
-- category + deal size + region combination within 90 days.

CREATE TABLE IF NOT EXISTS public.buyer_seed_cache (
  cache_key    TEXT PRIMARY KEY,
  buyer_ids    UUID[] DEFAULT '{}',
  seeded_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_seed_cache_expires
  ON public.buyer_seed_cache(expires_at);

ALTER TABLE public.buyer_seed_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.buyer_seed_cache
  FOR ALL USING (public.is_admin_or_moderator());
