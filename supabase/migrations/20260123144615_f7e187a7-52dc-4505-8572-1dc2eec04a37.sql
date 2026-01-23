-- Create junction table for deal-universe links
CREATE TABLE public.remarketing_universe_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active', -- active, archived
  notes TEXT,
  UNIQUE(universe_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.remarketing_universe_deals ENABLE ROW LEVEL SECURITY;

-- Admin-only management policy
CREATE POLICY "Admins can manage universe deals" 
ON public.remarketing_universe_deals
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Create index for faster lookups
CREATE INDEX idx_remarketing_universe_deals_universe ON public.remarketing_universe_deals(universe_id);
CREATE INDEX idx_remarketing_universe_deals_listing ON public.remarketing_universe_deals(listing_id);