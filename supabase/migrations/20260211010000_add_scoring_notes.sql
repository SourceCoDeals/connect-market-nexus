ALTER TABLE listings ADD COLUMN IF NOT EXISTS scoring_notes TEXT;

COMMENT ON COLUMN listings.scoring_notes IS 'Human-readable breakdown of how the deal quality score was calculated (v4+)';
