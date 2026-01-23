-- Create bucket for deal transcript files
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-transcripts', 'deal-transcripts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for admin access only
CREATE POLICY "Admins can upload deal transcripts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'deal-transcripts' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can read deal transcripts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'deal-transcripts' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can update deal transcripts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'deal-transcripts' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can delete deal transcripts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'deal-transcripts' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);