-- Upload the SourceCo logo to public storage for email signatures
INSERT INTO storage.objects (bucket_id, name, public, metadata)
SELECT 'listing-images', 'sourceco-logo.png', true, jsonb_build_object('mimetype', 'image/png')
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects 
  WHERE bucket_id = 'listing-images' AND name = 'sourceco-logo.png'
);

-- Create RLS policy for public logo access
CREATE POLICY IF NOT EXISTS "Public logo access"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images' AND name = 'sourceco-logo.png');