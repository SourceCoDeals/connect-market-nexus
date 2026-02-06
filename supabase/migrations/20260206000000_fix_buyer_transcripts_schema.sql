-- =============================================
-- FIX BUYER_TRANSCRIPTS SCHEMA MISMATCH
-- =============================================
-- Problem: Migration 20260204_buyer_fit_criteria_extraction.sql tried to
-- CREATE TABLE IF NOT EXISTS with new columns (extracted_insights, extraction_status)
-- but the table already existed from migration 20260122194512, so those
-- columns were never created.
--
-- This migration adds the missing columns and migrates data from old columns.

-- Add missing columns that should have been created
ALTER TABLE public.buyer_transcripts
ADD COLUMN IF NOT EXISTS extracted_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS extraction_error TEXT,
ADD COLUMN IF NOT EXISTS universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS transcript_type TEXT DEFAULT 'call' CHECK (transcript_type IN ('call', 'meeting', 'email', 'notes')),
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

-- Drop the old extracted_data column (after data migration)
-- Note: Commenting this out for safety - can drop manually after verifying
-- ALTER TABLE public.buyer_transcripts DROP COLUMN IF EXISTS extracted_data;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_extraction_status
ON public.buyer_transcripts(extraction_status);

CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_universe_id
ON public.buyer_transcripts(universe_id);

CREATE INDEX IF NOT EXISTS idx_buyer_transcripts_call_date
ON public.buyer_transcripts(call_date DESC);

-- Add comment explaining the schema
COMMENT ON COLUMN public.buyer_transcripts.extracted_insights IS 'Extracted buyer insights (thesis, criteria, etc.) from AI processing';
COMMENT ON COLUMN public.buyer_transcripts.extraction_status IS 'Status of AI extraction: pending, processing, completed, failed';
COMMENT ON COLUMN public.buyer_transcripts.extracted_data IS 'DEPRECATED: Use extracted_insights instead. Kept for backward compatibility.';
