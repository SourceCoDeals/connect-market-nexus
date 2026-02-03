-- Migration: Remove deal_motivation_score column
-- This field is redundant since we use seller_interest_score from transcript analysis

-- Drop the deal_motivation_score column from listings table
ALTER TABLE public.listings
DROP COLUMN IF EXISTS deal_motivation_score;

-- Add comment explaining seller interest scoring
COMMENT ON COLUMN public.listings.seller_interest_score IS 'AI-analyzed seller motivation score (0-100) from notes/transcripts via analyze-seller-interest function';
