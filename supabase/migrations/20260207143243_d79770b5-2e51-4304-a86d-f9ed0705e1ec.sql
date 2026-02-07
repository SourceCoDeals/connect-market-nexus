ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_total_score INTEGER;
COMMENT ON COLUMN listings.deal_total_score IS 'Overall deal quality score (0-100). Used by scoring attractiveness multiplier.';

ALTER TABLE listings ADD COLUMN IF NOT EXISTS ideal_buyer TEXT;
COMMENT ON COLUMN listings.ideal_buyer IS 'Description of ideal buyer profile from seller perspective.';