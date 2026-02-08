-- Add notes_analyzed_at timestamp to remarketing_buyers table
-- This tracks when buyer notes were last analyzed for data extraction

ALTER TABLE public.remarketing_buyers
ADD COLUMN IF NOT EXISTS notes_analyzed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.remarketing_buyers.notes_analyzed_at IS 'Timestamp when notes were last analyzed for data extraction';
