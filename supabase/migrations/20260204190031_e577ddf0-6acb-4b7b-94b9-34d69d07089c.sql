-- Create buyer_criteria_extractions table for tracking extraction progress
CREATE TABLE IF NOT EXISTS public.buyer_criteria_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.criteria_extraction_sources(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_phase TEXT,
  phases_completed INTEGER NOT NULL DEFAULT 0,
  total_phases INTEGER NOT NULL DEFAULT 4,
  extracted_criteria JSONB DEFAULT '{}',
  confidence_scores JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_extractions_universe_id 
  ON public.buyer_criteria_extractions(universe_id);
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_extractions_status 
  ON public.buyer_criteria_extractions(status);
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_extractions_universe_status 
  ON public.buyer_criteria_extractions(universe_id, status);

-- Unique constraint: only one active extraction per universe at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_criteria_extractions_active_per_universe
  ON public.buyer_criteria_extractions(universe_id) 
  WHERE status IN ('pending', 'processing');

-- Enable RLS
ALTER TABLE public.buyer_criteria_extractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage extractions for universes they own
CREATE POLICY "Users can view their own extractions"
  ON public.buyer_criteria_extractions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.remarketing_buyer_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert extractions for their universes"
  ON public.buyer_criteria_extractions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.remarketing_buyer_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own extractions"
  ON public.buyer_criteria_extractions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.remarketing_buyer_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own extractions"
  ON public.buyer_criteria_extractions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.remarketing_buyer_universes u
      WHERE u.id = buyer_criteria_extractions.universe_id
      AND u.created_by = auth.uid()
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role can manage all extractions"
  ON public.buyer_criteria_extractions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_buyer_criteria_extractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_buyer_criteria_extractions_updated_at
  BEFORE UPDATE ON public.buyer_criteria_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_buyer_criteria_extractions_updated_at();

-- Zombie cleanup function: mark stuck extractions as failed after 10 minutes
CREATE OR REPLACE FUNCTION public.cleanup_zombie_extractions()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE public.buyer_criteria_extractions
  SET 
    status = 'failed',
    error = 'Extraction timed out after 10 minutes',
    completed_at = now()
  WHERE 
    status IN ('pending', 'processing')
    AND started_at < now() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;