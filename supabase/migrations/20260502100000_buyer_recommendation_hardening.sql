-- Hardening migration for buyer recommendation tables.
-- Adds missing indexes, CHECK constraints, and FK comment.

-- 1. Missing index on buyer_seed_log.category_cache_key
--    Speeds up lookups when checking seed history for a given cache key.
CREATE INDEX IF NOT EXISTS idx_buyer_seed_log_cache_key
  ON public.buyer_seed_log(category_cache_key);

-- 2. Missing composite index on buyer_seed_log (source_deal_id, seeded_at)
--    Supports "show seed history for a deal" queries.
CREATE INDEX IF NOT EXISTS idx_buyer_seed_log_deal_seeded
  ON public.buyer_seed_log(source_deal_id, seeded_at DESC);

-- 3. Time-range index on buyer_recommendation_cache (listing_id, expires_at)
--    The cache lookup filters on both listing_id and expires_at.
--    The unique index on listing_id alone doesn't cover the expires_at filter.
CREATE INDEX IF NOT EXISTS idx_buyer_rec_cache_listing_expires
  ON public.buyer_recommendation_cache(listing_id, expires_at);

-- 4. CHECK constraint: buyer_recommendation_cache.buyer_count must be non-negative
ALTER TABLE public.buyer_recommendation_cache
  ADD CONSTRAINT chk_buyer_rec_cache_count_nonneg CHECK (buyer_count >= 0);

-- 5. CHECK constraint: buyer_seed_log.action must be a known value
ALTER TABLE public.buyer_seed_log
  ADD CONSTRAINT chk_seed_log_action CHECK (
    action IN ('inserted', 'enriched_existing', 'probable_duplicate')
  );

-- 6. Add a COMMENT on buyer_recommendation_cache.listing_id noting the FK relationship
--    (No hard FK because listings may be deleted independently, but document intent.)
COMMENT ON COLUMN public.buyer_recommendation_cache.listing_id IS
  'References listings(id). No hard FK to allow independent lifecycle management; cache rows are short-lived (4h TTL).';

-- 7. Add a COMMENT on buyer_seed_cache.cache_key documenting format
COMMENT ON COLUMN public.buyer_seed_cache.cache_key IS
  'Format: seed:<listing_id>:<industry>:<categories>:<state>:<ebitda_bucket>. Includes listing_id to prevent cross-deal cache collisions.';
