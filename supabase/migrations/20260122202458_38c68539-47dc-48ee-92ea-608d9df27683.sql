-- =============================================
-- REMARKETING TOOL SCHEMA ENHANCEMENTS
-- =============================================

-- 1. Deal Transcripts Table (transcripts attached to deals/listings)
CREATE TABLE public.deal_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  source TEXT DEFAULT 'call',
  extracted_data JSONB DEFAULT '{}',
  applied_to_deal BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deal_transcripts (admin only)
CREATE POLICY "Admins can view deal transcripts"
  ON public.deal_transcripts FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert deal transcripts"
  ON public.deal_transcripts FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update deal transcripts"
  ON public.deal_transcripts FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete deal transcripts"
  ON public.deal_transcripts FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 2. Industry Trackers Table
CREATE TABLE public.industry_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  deal_count INTEGER DEFAULT 0,
  buyer_count INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.industry_trackers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for industry_trackers (admin only)
CREATE POLICY "Admins can manage industry trackers"
  ON public.industry_trackers FOR ALL
  USING (public.is_admin(auth.uid()));

-- 3. Deal Scoring Adjustments Table
CREATE TABLE public.deal_scoring_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL,
  adjustment_value NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_scoring_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deal_scoring_adjustments (admin only)
CREATE POLICY "Admins can manage deal scoring adjustments"
  ON public.deal_scoring_adjustments FOR ALL
  USING (public.is_admin(auth.uid()));

-- 4. Add missing columns to remarketing_buyers
ALTER TABLE public.remarketing_buyers 
  ADD COLUMN IF NOT EXISTS pe_firm_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_agreement_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'low';

-- 5. Add industry_id to remarketing_buyers for industry tracking
ALTER TABLE public.remarketing_buyers
  ADD COLUMN IF NOT EXISTS industry_tracker_id UUID REFERENCES public.industry_trackers(id) ON DELETE SET NULL;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_transcripts_listing_id ON public.deal_transcripts(listing_id);
CREATE INDEX IF NOT EXISTS idx_deal_scoring_adjustments_listing_id ON public.deal_scoring_adjustments(listing_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_pe_firm_id ON public.remarketing_buyers(pe_firm_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_industry_tracker_id ON public.remarketing_buyers(industry_tracker_id);
CREATE INDEX IF NOT EXISTS idx_industry_trackers_universe_id ON public.industry_trackers(universe_id);

-- 7. Update trigger for updated_at on new tables
CREATE TRIGGER update_deal_transcripts_updated_at
  BEFORE UPDATE ON public.deal_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_industry_trackers_updated_at
  BEFORE UPDATE ON public.industry_trackers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();