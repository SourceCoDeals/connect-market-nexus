-- Add deal_owner_id column to listings table
-- This tracks which admin user "owns" a deal
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deal_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for fast lookup by deal owner
CREATE INDEX IF NOT EXISTS idx_listings_deal_owner_id ON public.listings(deal_owner_id);
