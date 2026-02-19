
-- Add deal flags to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS need_buyer_universe boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS need_owner_contact boolean DEFAULT false;

-- Add fee agreement required flag to buyer universes
ALTER TABLE public.remarketing_buyer_universes
  ADD COLUMN IF NOT EXISTS fee_agreement_required boolean DEFAULT false;
