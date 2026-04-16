-- ============================================================================
-- Add content_hash column to buyer_recommendation_cache
--
-- Background
-- ----------
-- score-deal-buyers computes a content_hash that mixes deal fields whose
-- changes should invalidate cached buyer rankings (industry, revenue, EBITDA,
-- categories, etc). The edge function already calculates the hash and even
-- comments out the upsert line waiting for this column. Without it, when an
-- operator fixes a deal's category or size range, the matching page can keep
-- showing stale rankings for up to 4 hours (CACHE_HOURS) with no way to force
-- a refresh short of clearing the row.
--
-- This migration adds the column (nullable, no default) so the edge function
-- can start writing it. Reads that land before the edge function is updated
-- simply ignore NULL hashes and fall back to TTL-only invalidation — so this
-- is forward-compatible.
-- ============================================================================

ALTER TABLE public.buyer_recommendation_cache
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN public.buyer_recommendation_cache.content_hash IS
  'Hash of deal fields that should invalidate cached rankings when changed. '
  'Computed by score-deal-buyers edge function. NULL means "TTL-only".';
