-- Create buyer_transcripts table for storing call transcripts
CREATE TABLE public.buyer_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.remarketing_buyers(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  source TEXT DEFAULT 'call' CHECK (source IN ('call', 'meeting', 'email', 'other')),
  extracted_data JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_buyer_transcripts_buyer_id ON public.buyer_transcripts(buyer_id);
CREATE INDEX idx_buyer_transcripts_created_at ON public.buyer_transcripts(created_at DESC);

-- Enable RLS
ALTER TABLE public.buyer_transcripts ENABLE ROW LEVEL SECURITY;

-- Create admin-only policies
CREATE POLICY "Admins can view buyer transcripts"
ON public.buyer_transcripts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can insert buyer transcripts"
ON public.buyer_transcripts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update buyer transcripts"
ON public.buyer_transcripts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can delete buyer transcripts"
ON public.buyer_transcripts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_buyer_transcripts_updated_at
BEFORE UPDATE ON public.buyer_transcripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();