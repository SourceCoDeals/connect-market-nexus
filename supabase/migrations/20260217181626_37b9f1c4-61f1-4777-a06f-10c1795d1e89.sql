
-- Create the scoring queue table
CREATE TABLE public.remarketing_scoring_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL CHECK (score_type IN ('alignment', 'deal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Index for worker polling
CREATE INDEX idx_scoring_queue_pending ON public.remarketing_scoring_queue (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_scoring_queue_universe ON public.remarketing_scoring_queue (universe_id, score_type);

-- Enable RLS
ALTER TABLE public.remarketing_scoring_queue ENABLE ROW LEVEL SECURITY;

-- Admin-only access (same pattern as other remarketing tables)
CREATE POLICY "Admins can manage scoring queue"
  ON public.remarketing_scoring_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
