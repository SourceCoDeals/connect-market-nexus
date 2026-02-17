-- Phase 2: Drop write-only columns from listings table
-- These columns were written by enrichment/extraction but never read or displayed.
-- Code references removed in accompanying commit.

ALTER TABLE public.listings
  DROP COLUMN IF EXISTS headquarters_address,
  DROP COLUMN IF EXISTS has_management_team,
  DROP COLUMN IF EXISTS mr_notes,
  DROP COLUMN IF EXISTS revenue_trend;
