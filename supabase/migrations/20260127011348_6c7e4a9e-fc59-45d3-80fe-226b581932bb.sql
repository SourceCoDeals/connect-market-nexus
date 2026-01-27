-- Add extraction sources and confidence tracking to listings table per spec
-- This enables the source priority system: Transcript > Notes > Website > CSV

-- Add extraction_sources JSONB field to track field-level source origins
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS extraction_sources JSONB DEFAULT '{}'::jsonb;

-- Add confidence tracking for primary financial metrics
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS revenue_confidence TEXT CHECK (revenue_confidence IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS revenue_is_inferred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS revenue_source_quote TEXT,
ADD COLUMN IF NOT EXISTS ebitda_confidence TEXT CHECK (ebitda_confidence IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS ebitda_is_inferred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ebitda_source_quote TEXT;

-- Add notes_analyzed_at to track when notes were last processed
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS notes_analyzed_at TIMESTAMPTZ;

-- Add comment explaining the extraction_sources structure
COMMENT ON COLUMN public.listings.extraction_sources IS 'JSONB tracking source of each extracted field. Structure: { fieldName: { source: "transcript"|"notes"|"website"|"csv", timestamp: ISO8601, transcriptId?: string } }';

COMMENT ON COLUMN public.listings.revenue_confidence IS 'Confidence level of revenue extraction: high, medium, or low';
COMMENT ON COLUMN public.listings.ebitda_confidence IS 'Confidence level of EBITDA extraction: high, medium, or low';