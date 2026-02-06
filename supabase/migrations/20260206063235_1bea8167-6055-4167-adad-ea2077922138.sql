-- Fix buyer_transcripts schema mismatch
ALTER TABLE public.buyer_transcripts
ADD COLUMN IF NOT EXISTS extracted_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS transcript_type TEXT DEFAULT 'call',
ADD COLUMN IF NOT EXISTS call_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS participants TEXT[],
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS transcript_source TEXT,
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Migrate data from old column to new column
UPDATE public.buyer_transcripts
SET extracted_insights = extracted_data
WHERE extracted_data IS NOT NULL AND extracted_data != '{}'::jsonb;

-- Set extraction_status based on whether transcript was processed
UPDATE public.buyer_transcripts
SET extraction_status = CASE
  WHEN processed_at IS NOT NULL THEN 'completed'
  ELSE 'pending'
END;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_extraction_status ON public.buyer_transcripts(extraction_status);
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_universe_id ON public.buyer_transcripts(universe_id);
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_call_date ON public.buyer_transcripts(call_date DESC);