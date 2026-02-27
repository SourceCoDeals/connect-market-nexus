-- ═══════════════════════════════════════════════════════════════
-- Migration: add_universe_build_priority
-- Date: 2026-03-29
-- Purpose: Adds a priority ordering column to listings for ranking deals
--          flagged for buyer universe building, enabling drag-and-drop reordering.
-- Tables affected: listings
-- ═══════════════════════════════════════════════════════════════

-- Add priority ordering for the "To Be Created" buyer universe list
-- Allows drag-and-drop ranking of deals flagged for universe build

ALTER TABLE listings ADD COLUMN IF NOT EXISTS universe_build_priority integer;

CREATE INDEX IF NOT EXISTS idx_listings_universe_build_priority
  ON listings (universe_build_priority)
  WHERE universe_build_flagged = true;
