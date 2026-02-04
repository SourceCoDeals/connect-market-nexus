-- Create table to track M&A guide generation progress
CREATE TABLE public.ma_guide_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id UUID NOT NULL REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_phase TEXT,
  phases_completed INTEGER NOT NULL DEFAULT 0,
  total_phases INTEGER NOT NULL DEFAULT 13,
  generated_content JSONB DEFAULT '{}',
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by universe
CREATE INDEX idx_ma_guide_generations_universe ON public.ma_guide_generations(universe_id);
CREATE INDEX idx_ma_guide_generations_status ON public.ma_guide_generations(status);

-- Partial unique index: only one pending/processing generation per universe at a time
CREATE UNIQUE INDEX idx_ma_guide_generations_active_per_universe 
ON public.ma_guide_generations(universe_id) 
WHERE status IN ('pending', 'processing');

-- Enable RLS
ALTER TABLE public.ma_guide_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can view generations for universes they have access to
CREATE POLICY "Users can view their own universe generations"
ON public.ma_guide_generations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.remarketing_buyer_universes ru
    WHERE ru.id = universe_id AND ru.created_by = auth.uid()
  )
);

-- Allow service role to manage all generations (for edge functions)
CREATE POLICY "Service role can manage generations"
ON public.ma_guide_generations
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_ma_guide_generations_updated_at
BEFORE UPDATE ON public.ma_guide_generations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();