-- Migration A: buyer_recommendation_cache table
-- Stores scored results per deal so the page load is fast on return visits.

CREATE TABLE IF NOT EXISTS public.buyer_recommendation_cache (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     UUID NOT NULL,
  scored_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '4 hours',
  buyer_count    INTEGER DEFAULT 0,
  results        JSONB NOT NULL DEFAULT '[]',
  score_version  TEXT DEFAULT 'v1'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_rec_cache_listing
  ON public.buyer_recommendation_cache(listing_id);

CREATE INDEX IF NOT EXISTS idx_buyer_rec_cache_expires
  ON public.buyer_recommendation_cache(expires_at);

-- RLS: admins can read/write, no public access
ALTER TABLE public.buyer_recommendation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.buyer_recommendation_cache
  FOR ALL USING (public.is_admin_or_moderator());
