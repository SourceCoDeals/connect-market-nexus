-- Simply upload the premium SourceCo logo reference to storage bucket metadata
-- Ensure listing-images bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Insert a metadata entry for the premium logo
INSERT INTO storage.objects (bucket_id, name, public, metadata)
VALUES ('listing-images', 'sourceco-logo-premium.png', true, jsonb_build_object('mimetype', 'image/png', 'description', 'SourceCo premium black and gold logo'))
ON CONFLICT (bucket_id, name) DO UPDATE SET 
  public = EXCLUDED.public,
  metadata = EXCLUDED.metadata;