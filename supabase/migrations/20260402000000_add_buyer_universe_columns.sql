-- Add buyer universe label and description columns to listings
-- These are AI-generated fields that describe who would buy this company
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS buyer_universe_label text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS buyer_universe_description text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS buyer_universe_generated_at timestamptz;
