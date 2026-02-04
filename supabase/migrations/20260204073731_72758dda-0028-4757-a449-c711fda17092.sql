-- Create storage bucket for universe documents (M&A guides, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'universe-documents',
  'universe-documents',
  true,
  52428800, -- 50MB limit
  ARRAY['text/html', 'application/pdf', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow anyone to read documents (public bucket)
CREATE POLICY "Public read access for universe documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'universe-documents');

-- Create policy to allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload universe documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'universe-documents' 
  AND auth.role() = 'authenticated'
);

-- Create policy for service role to upload (edge functions)
CREATE POLICY "Service role can manage universe documents"
ON storage.objects
FOR ALL
USING (bucket_id = 'universe-documents')
WITH CHECK (bucket_id = 'universe-documents');