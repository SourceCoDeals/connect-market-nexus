-- Add priority ordering for the "To Be Created" buyer universe list
-- Allows drag-and-drop ranking of deals flagged for universe build

ALTER TABLE listings ADD COLUMN IF NOT EXISTS universe_build_priority integer;

CREATE INDEX IF NOT EXISTS idx_listings_universe_build_priority
  ON listings (universe_build_priority)
  WHERE universe_build_flagged = true;
