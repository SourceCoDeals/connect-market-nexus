-- Create buyer enrichment queue table for persistent background processing
CREATE TABLE public.buyer_enrichment_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rate_limited')),
  attempts INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(buyer_id)
);

-- Enable RLS
ALTER TABLE public.buyer_enrichment_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and manage queue
CREATE POLICY "Authenticated users can view buyer queue" 
  ON public.buyer_enrichment_queue FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert into buyer queue" 
  ON public.buyer_enrichment_queue FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update buyer queue" 
  ON public.buyer_enrichment_queue FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete from buyer queue" 
  ON public.buyer_enrichment_queue FOR DELETE 
  USING (auth.uid() IS NOT NULL);

-- Create index for efficient queue processing
CREATE INDEX idx_buyer_enrichment_queue_status ON public.buyer_enrichment_queue(status, queued_at);
CREATE INDEX idx_buyer_enrichment_queue_universe ON public.buyer_enrichment_queue(universe_id);
CREATE INDEX idx_buyer_enrichment_queue_rate_limit ON public.buyer_enrichment_queue(status, rate_limit_reset_at) WHERE status = 'rate_limited';

-- Create updated_at trigger
CREATE TRIGGER update_buyer_enrichment_queue_updated_at
  BEFORE UPDATE ON public.buyer_enrichment_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();