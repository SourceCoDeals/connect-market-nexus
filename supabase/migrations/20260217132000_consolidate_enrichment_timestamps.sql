-- Phase 3: Consolidate enrichment timestamps on listings table
-- last_enriched_at is redundant with enriched_at (both set to the same value).
-- Merge any data where enriched_at is null, then drop last_enriched_at.
-- NOTE: enrichment_status is kept — it tracks pending/failed states in the dashboard.
-- NOTE: This only affects the listings table. The deals table retains last_enriched_at.

UPDATE public.listings
SET enriched_at = last_enriched_at
WHERE enriched_at IS NULL
  AND last_enriched_at IS NOT NULL;

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS last_enriched_at;
