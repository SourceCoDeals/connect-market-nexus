-- Add deal_sources text[] column so a deal can belong to multiple pipelines.
-- Previously deal_source was a single text field, meaning a deal imported
-- into SourceCo that already existed in CapTarget would stay invisible to
-- the SourceCo page because deal_source was never updated.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS deal_sources text[] DEFAULT '{}'::text[];

-- Backfill from existing deal_source
UPDATE listings
SET deal_sources = ARRAY[deal_source]
WHERE deal_source IS NOT NULL
  AND (deal_sources IS NULL OR deal_sources = '{}'::text[]);

-- GIN index for fast @> (contains) queries
CREATE INDEX IF NOT EXISTS idx_listings_deal_sources_gin
  ON listings USING GIN (deal_sources);
