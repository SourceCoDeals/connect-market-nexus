-- Add alignment tracking columns to remarketing_buyers table
ALTER TABLE remarketing_buyers ADD COLUMN IF NOT EXISTS alignment_score INTEGER CHECK (alignment_score >= 0 AND alignment_score <= 100);
ALTER TABLE remarketing_buyers ADD COLUMN IF NOT EXISTS alignment_reasoning TEXT;
ALTER TABLE remarketing_buyers ADD COLUMN IF NOT EXISTS alignment_checked_at TIMESTAMP WITH TIME ZONE;

-- Add index for sorting by alignment score with nulls last
CREATE INDEX IF NOT EXISTS idx_buyers_alignment_score ON remarketing_buyers(alignment_score DESC NULLS LAST);