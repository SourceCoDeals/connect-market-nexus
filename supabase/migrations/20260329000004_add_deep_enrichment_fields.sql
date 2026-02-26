-- Add deep enrichment fields for richer transcript extraction
-- These fields support memo-quality data from Fireflies call transcripts

-- Financial depth fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS add_backs text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS debt_details text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS capex_details text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS recurring_revenue_percentage numeric;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS seasonality_details text;

-- Workforce and management fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS workforce_details text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS management_team text;

-- Competitive position field
ALTER TABLE listings ADD COLUMN IF NOT EXISTS competitive_advantages text;
