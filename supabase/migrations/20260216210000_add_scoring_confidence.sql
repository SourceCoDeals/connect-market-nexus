-- Add scoring_confidence column for deal scoring v5
-- Values: 'high', 'medium', 'low', 'very_low'
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS scoring_confidence TEXT;
