
-- Add missing columns to buyer_transcripts for manual transcript support
ALTER TABLE public.buyer_transcripts 
  ADD COLUMN IF NOT EXISTS transcript_text text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_insights jsonb;

-- Make fireflies_transcript_id nullable so manual transcripts work
ALTER TABLE public.buyer_transcripts 
  ALTER COLUMN fireflies_transcript_id DROP NOT NULL;
