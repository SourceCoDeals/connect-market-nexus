-- Create buyer_learning_history table for tracking pass/approve decisions
CREATE TABLE public.buyer_learning_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE SET NULL,
  score_id UUID REFERENCES public.remarketing_scores(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'passed', 'hidden')),
  pass_reason TEXT,
  pass_category TEXT,
  composite_score NUMERIC,
  geography_score NUMERIC,
  size_score NUMERIC,
  service_score NUMERIC,
  owner_goals_score NUMERIC,
  action_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_buyer_learning_history_buyer_id ON public.buyer_learning_history(buyer_id);
CREATE INDEX idx_buyer_learning_history_listing_id ON public.buyer_learning_history(listing_id);
CREATE INDEX idx_buyer_learning_history_universe_id ON public.buyer_learning_history(universe_id);
CREATE INDEX idx_buyer_learning_history_action ON public.buyer_learning_history(action);
CREATE INDEX idx_buyer_learning_history_created_at ON public.buyer_learning_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.buyer_learning_history ENABLE ROW LEVEL SECURITY;

-- Create admin-only policies
CREATE POLICY "Admins can view buyer learning history"
ON public.buyer_learning_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can insert buyer learning history"
ON public.buyer_learning_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update buyer learning history"
ON public.buyer_learning_history
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can delete buyer learning history"
ON public.buyer_learning_history
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);