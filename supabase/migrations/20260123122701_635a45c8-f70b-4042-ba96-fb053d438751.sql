-- Add missing columns for buyer detail parity with Whispers

-- Add sweet spot and deal structure columns
ALTER TABLE remarketing_buyers 
  ADD COLUMN IF NOT EXISTS revenue_sweet_spot NUMERIC,
  ADD COLUMN IF NOT EXISTS ebitda_sweet_spot NUMERIC,
  ADD COLUMN IF NOT EXISTS deal_preferences TEXT,
  ADD COLUMN IF NOT EXISTS deal_breakers TEXT[],
  ADD COLUMN IF NOT EXISTS acquisition_timeline TEXT;

-- Add customer/market columns  
ALTER TABLE remarketing_buyers
  ADD COLUMN IF NOT EXISTS primary_customer_size TEXT,
  ADD COLUMN IF NOT EXISTS customer_geographic_reach TEXT,
  ADD COLUMN IF NOT EXISTS customer_industries TEXT[],
  ADD COLUMN IF NOT EXISTS target_customer_profile TEXT;

-- Add key quotes for transcript extraction
ALTER TABLE remarketing_buyers
  ADD COLUMN IF NOT EXISTS key_quotes TEXT[];

-- Add file upload support to buyer_transcripts
ALTER TABLE buyer_transcripts
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_size INTEGER;