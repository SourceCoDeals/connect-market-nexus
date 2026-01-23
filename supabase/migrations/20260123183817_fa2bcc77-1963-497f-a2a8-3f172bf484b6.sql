-- Add confidence tracking columns to listings table for Whispers parity
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS revenue_confidence TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS ebitda_confidence TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS revenue_source_quote TEXT,
  ADD COLUMN IF NOT EXISTS ebitda_source_quote TEXT,
  ADD COLUMN IF NOT EXISTS customer_concentration TEXT,
  ADD COLUMN IF NOT EXISTS customer_geography TEXT;