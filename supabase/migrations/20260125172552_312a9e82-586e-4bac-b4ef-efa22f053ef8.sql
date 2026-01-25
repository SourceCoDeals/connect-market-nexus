-- Add missing columns to remarketing_buyer_universes for full M&A Guide system
ALTER TABLE public.remarketing_buyer_universes 
ADD COLUMN IF NOT EXISTS fit_criteria_size TEXT,
ADD COLUMN IF NOT EXISTS fit_criteria_service TEXT,
ADD COLUMN IF NOT EXISTS fit_criteria_geography TEXT,
ADD COLUMN IF NOT EXISTS fit_criteria_buyer_types TEXT,
ADD COLUMN IF NOT EXISTS ma_guide_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ma_guide_qa_context JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS documents_analyzed_at TIMESTAMPTZ;

-- Create storage bucket for universe documents if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tracker-documents', 'tracker-documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for tracker-documents bucket
CREATE POLICY "Authenticated users can upload tracker documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tracker-documents');

CREATE POLICY "Authenticated users can view tracker documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tracker-documents');

CREATE POLICY "Authenticated users can delete tracker documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tracker-documents');

-- Add comment to clarify column purposes
COMMENT ON COLUMN public.remarketing_buyer_universes.fit_criteria_size IS 'Human-readable size criteria summary (e.g., "Revenue: $5M-$25M, EBITDA: $1M+")';
COMMENT ON COLUMN public.remarketing_buyer_universes.fit_criteria_service IS 'Human-readable service/industry criteria summary';
COMMENT ON COLUMN public.remarketing_buyer_universes.fit_criteria_geography IS 'Human-readable geography criteria summary';
COMMENT ON COLUMN public.remarketing_buyer_universes.fit_criteria_buyer_types IS 'Human-readable buyer types criteria summary';
COMMENT ON COLUMN public.remarketing_buyer_universes.ma_guide_generated_at IS 'Timestamp when M&A guide was last AI-generated';
COMMENT ON COLUMN public.remarketing_buyer_universes.ma_guide_qa_context IS 'Quality check results from M&A guide generation';
COMMENT ON COLUMN public.remarketing_buyer_universes.documents_analyzed_at IS 'Timestamp when uploaded documents were last analyzed';