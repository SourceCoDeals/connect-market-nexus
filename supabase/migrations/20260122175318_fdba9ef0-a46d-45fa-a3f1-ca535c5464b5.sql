-- Create outreach_records table for tracking introduction status
CREATE TABLE public.outreach_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  score_id UUID REFERENCES public.remarketing_scores(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  
  -- Status tracking
  contacted_at TIMESTAMPTZ,
  contacted_by UUID REFERENCES auth.users(id),
  nda_sent_at TIMESTAMPTZ,
  nda_sent_by UUID REFERENCES auth.users(id),
  nda_signed_at TIMESTAMPTZ,
  cim_sent_at TIMESTAMPTZ,
  cim_sent_by UUID REFERENCES auth.users(id),
  meeting_scheduled_at TIMESTAMPTZ,
  meeting_notes TEXT,
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('in_progress', 'won', 'lost', 'withdrawn', 'no_response')),
  outcome_notes TEXT,
  outcome_at TIMESTAMPTZ,
  
  -- Follow-up tracking
  last_contact_date TIMESTAMPTZ,
  next_action TEXT,
  next_action_date TIMESTAMPTZ,
  
  -- Metadata
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique buyer-listing combination
  CONSTRAINT unique_buyer_listing UNIQUE (buyer_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.outreach_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins only
CREATE POLICY "Admins can view all outreach records"
  ON public.outreach_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert outreach records"
  ON public.outreach_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update outreach records"
  ON public.outreach_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete outreach records"
  ON public.outreach_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX idx_outreach_listing ON public.outreach_records(listing_id);
CREATE INDEX idx_outreach_buyer ON public.outreach_records(buyer_id);
CREATE INDEX idx_outreach_outcome ON public.outreach_records(outcome);
CREATE INDEX idx_outreach_next_action ON public.outreach_records(next_action_date) WHERE next_action_date IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_outreach_records_updated_at
  BEFORE UPDATE ON public.outreach_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();