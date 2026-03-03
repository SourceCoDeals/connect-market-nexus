-- Migration: Clear stale buyer recommendation caches after scoring changes
-- Reason: Multiple scoring algorithm changes make all cached results incorrect:
--   1. Removed inflated 30-baseline from scoreService (scores will be lower for data-sparse buyers)
--   2. Replaced substring matching with word-boundary regex (some adjacent matches will drop off)
--   3. Synonym dictionary restructured (removed generic bridge terms that caused false exact-matches)
--   4. Multi-signal collection (fit_signals arrays will have more entries)
--   5. Fit descriptions completely rewritten (longer, richer format)
-- Seed caches are NOT cleared — AI seeding prompt was not changed.

TRUNCATE TABLE buyer_recommendation_cache;
