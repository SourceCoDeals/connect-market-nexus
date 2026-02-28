-- Add source_deal_id column to listings table
-- This tracks which deal a marketplace listing was created from
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_deal_id uuid REFERENCES listings(id);

-- Index for quick lookups: "does this deal already have a listing?"
CREATE INDEX IF NOT EXISTS idx_listings_source_deal_id ON listings(source_deal_id) WHERE source_deal_id IS NOT NULL;
