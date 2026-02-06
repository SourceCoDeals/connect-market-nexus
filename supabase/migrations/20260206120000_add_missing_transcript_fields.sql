-- Add missing columns that extract-deal-transcript edge function needs
-- These fields are extracted from transcripts but columns don't exist in listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS transition_preferences TEXT,
  ADD COLUMN IF NOT EXISTS timeline_notes TEXT,
  ADD COLUMN IF NOT EXISTS end_market_description TEXT,
  ADD COLUMN IF NOT EXISTS headquarters_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_concentration TEXT,
  ADD COLUMN IF NOT EXISTS customer_geography TEXT,
  ADD COLUMN IF NOT EXISTS competitive_position TEXT,
  ADD COLUMN IF NOT EXISTS growth_trajectory TEXT,
  ADD COLUMN IF NOT EXISTS key_risks TEXT,
  ADD COLUMN IF NOT EXISTS technology_systems TEXT,
  ADD COLUMN IF NOT EXISTS real_estate_info TEXT,
  ADD COLUMN IF NOT EXISTS key_quotes JSONB,
  ADD COLUMN IF NOT EXISTS financial_notes TEXT,
  ADD COLUMN IF NOT EXISTS full_time_employees INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_confidence TEXT,
  ADD COLUMN IF NOT EXISTS revenue_is_inferred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revenue_source_quote TEXT,
  ADD COLUMN IF NOT EXISTS ebitda_confidence TEXT,
  ADD COLUMN IF NOT EXISTS ebitda_is_inferred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ebitda_source_quote TEXT;
