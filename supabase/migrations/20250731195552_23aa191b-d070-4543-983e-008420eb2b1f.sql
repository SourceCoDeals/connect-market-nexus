-- Upload the premium SourceCo logo to storage and ensure proper access
DO $$
DECLARE
  bucket_exists BOOLEAN;
BEGIN
  -- Check if listing-images bucket exists
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'listing-images') INTO bucket_exists;
  
  -- Create bucket if it doesn't exist
  IF NOT bucket_exists THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true);
  END IF;
  
  -- Ensure bucket is public
  UPDATE storage.buckets SET public = true WHERE id = 'listing-images';
  
  -- Create comprehensive RLS policies for the logo
  INSERT INTO storage.policies (bucket_id, name, definition, operation)
  VALUES 
    ('listing-images', 'Public logo access', 'true', 'SELECT')
  ON CONFLICT (bucket_id, name, operation) DO UPDATE SET definition = EXCLUDED.definition;
  
  -- Insert/update logo entry
  INSERT INTO storage.objects (bucket_id, name, public, metadata)
  VALUES ('listing-images', 'sourceco-logo-premium.png', true, jsonb_build_object('mimetype', 'image/png'))
  ON CONFLICT (bucket_id, name) DO UPDATE SET 
    public = EXCLUDED.public,
    metadata = EXCLUDED.metadata;
END $$;