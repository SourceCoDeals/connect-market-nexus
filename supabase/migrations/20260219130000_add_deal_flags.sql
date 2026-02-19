-- ============================================================================
-- ADD DEAL FLAGS: needs_buyer_universe, need_to_contact_owner
-- Also adds fee_agreement toggle capability to buyer universes
-- ============================================================================

-- ─── Add needs_buyer_universe flag to listings ───
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS needs_buyer_universe BOOLEAN DEFAULT false;

-- ─── Add need_to_contact_owner flag to listings ───
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS need_to_contact_owner BOOLEAN DEFAULT false;

-- ─── Indexes for filtering ───
CREATE INDEX IF NOT EXISTS idx_listings_needs_buyer_universe
  ON public.listings(needs_buyer_universe)
  WHERE needs_buyer_universe = true;

CREATE INDEX IF NOT EXISTS idx_listings_need_to_contact_owner
  ON public.listings(need_to_contact_owner)
  WHERE need_to_contact_owner = true;

-- ─── Add same flags to valuation_leads ───
ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS needs_buyer_universe BOOLEAN DEFAULT false;

ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS need_to_contact_owner BOOLEAN DEFAULT false;
