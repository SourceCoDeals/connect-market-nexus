-- ============================================================================
-- Add manual_rank_override to buyer_universes
--
-- Mirrors the ranking pattern on listings (Active Deals): admins can drag-and-
-- drop universes to assign a manual priority order. Null = unranked, ranked
-- rows sort ahead of unranked rows.
--
-- The backward-compatible remarketing_buyer_universes view is recreated so the
-- new column is exposed there as well (SELECT * views freeze their column list
-- at creation time and do not pick up new columns automatically).
-- ============================================================================

ALTER TABLE public.buyer_universes
  ADD COLUMN IF NOT EXISTS manual_rank_override INTEGER;

CREATE INDEX IF NOT EXISTS idx_buyer_universes_manual_rank
  ON public.buyer_universes (manual_rank_override ASC NULLS LAST, created_at DESC)
  WHERE archived = false;

CREATE OR REPLACE VIEW public.remarketing_buyer_universes AS
  SELECT * FROM public.buyer_universes;
