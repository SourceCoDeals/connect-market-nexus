-- ============================================================================
-- Fix: Update remarketing_scores unique constraint to include universe_id
-- ============================================================================
-- Previously, (listing_id, buyer_id) was unique, meaning scoring the same
-- buyer for the same listing in two different universes would overwrite.
-- Now each (listing_id, buyer_id, universe_id) is unique.
-- ============================================================================

-- Drop the old unique constraint
ALTER TABLE remarketing_scores
  DROP CONSTRAINT IF EXISTS remarketing_scores_listing_id_buyer_id_key;

-- Add new unique constraint including universe_id
ALTER TABLE remarketing_scores
  ADD CONSTRAINT remarketing_scores_listing_buyer_universe_key
  UNIQUE (listing_id, buyer_id, universe_id);
