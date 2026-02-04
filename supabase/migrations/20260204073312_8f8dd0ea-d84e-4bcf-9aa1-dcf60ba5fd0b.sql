-- Create table for tracking guide generation state (for resume functionality)
CREATE TABLE public.remarketing_guide_generation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'generating' CHECK (status IN ('idle', 'generating', 'completed', 'failed')),
  current_batch INT DEFAULT 0,
  current_phase INT DEFAULT 0,
  phase_name TEXT,
  saved_content TEXT,
  last_error JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint so each universe has at most one generation state
CREATE UNIQUE INDEX idx_guide_generation_state_universe ON public.remarketing_guide_generation_state(universe_id);

-- Enable RLS
ALTER TABLE public.remarketing_guide_generation_state ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write (admin functionality)
CREATE POLICY "Authenticated users can manage guide generation state"
ON public.remarketing_guide_generation_state
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Create trigger for updated_at
CREATE TRIGGER update_remarketing_guide_generation_state_updated_at
BEFORE UPDATE ON public.remarketing_guide_generation_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();