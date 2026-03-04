-- ============================================================================
-- CLEANUP: Drop unused columns
-- ============================================================================

-- confidence_level: Added in migration 20260122202458 but never read or written
-- by any edge function, frontend component, or type definition. Zero references.
ALTER TABLE public.buyers
  DROP COLUMN IF EXISTS confidence_level;
