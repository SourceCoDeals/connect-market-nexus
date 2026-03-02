-- ============================================================================
-- MIGRATION: Drop confirmed-dead columns from listings
-- ============================================================================
-- These columns have ZERO frontend/backend references (verified by grep audit):
--   - seller_interest_analyzed_at: never read or written in app code
--   - seller_interest_notes: never read or written in app code
--   - lead_source_id: never read or written in app code
--   - manual_rank_set_at: added in 20260306 migration but never used
--
-- NOT dropped (still alive):
--   - status_label: used in ai-command-center/deal-tools.ts
-- ============================================================================

BEGIN;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS seller_interest_analyzed_at,
  DROP COLUMN IF EXISTS seller_interest_notes,
  DROP COLUMN IF EXISTS lead_source_id,
  DROP COLUMN IF EXISTS manual_rank_set_at;

COMMIT;
