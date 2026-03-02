-- Migration: Clear all buyer recommendation caches
-- Reason: Scoring algorithm was overhauled (synonym expansion, expanded deal fields,
-- AI prompt rebuild, fit_reason construction). All existing cached scores are stale
-- and will produce incorrect results if served from cache.

-- 1. Clear scored buyer results (4h TTL cache)
TRUNCATE TABLE buyer_recommendation_cache;

-- 2. Clear AI seeding dedup cache (90-day TTL cache)
-- Forces re-seeding with the fixed AI prompt on next request
TRUNCATE TABLE buyer_seed_cache;

-- 3. Clear AI seeding audit trail
-- Old entries have why_relevant from the broken prompt (hardcoded placeholders)
TRUNCATE TABLE buyer_seed_log;

-- 4. Add unique constraint on seed log to prevent duplicate rows going forward
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_seed_log_buyer_deal
  ON public.buyer_seed_log (remarketing_buyer_id, source_deal_id);
