
-- ============================================================
-- Fix Storage RLS policies: replace legacy profiles.is_admin
-- with the is_admin() RPC function
-- ============================================================

-- 1) Admins can delete deal transcripts
DROP POLICY IF EXISTS "Admins can delete deal transcripts" ON storage.objects;
CREATE POLICY "Admins can delete deal transcripts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'deal-transcripts' AND is_admin(auth.uid()));

-- 2) Admins can manage all feedback attachments
DROP POLICY IF EXISTS "Admins can manage all feedback attachments" ON storage.objects;
CREATE POLICY "Admins can manage all feedback attachments"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'feedback-attachments' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'feedback-attachments' AND is_admin(auth.uid()));

-- 3) Admins can read deal transcripts
DROP POLICY IF EXISTS "Admins can read deal transcripts" ON storage.objects;
CREATE POLICY "Admins can read deal transcripts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'deal-transcripts' AND is_admin(auth.uid()));

-- 4) Admins can update deal transcripts
DROP POLICY IF EXISTS "Admins can update deal transcripts" ON storage.objects;
CREATE POLICY "Admins can update deal transcripts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'deal-transcripts' AND is_admin(auth.uid()));

-- 5) Admins can upload deal transcripts
DROP POLICY IF EXISTS "Admins can upload deal transcripts" ON storage.objects;
CREATE POLICY "Admins can upload deal transcripts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deal-transcripts' AND is_admin(auth.uid()));

-- 6) Allow admins to delete listing images
DROP POLICY IF EXISTS "Allow admins to delete listing images" ON storage.objects;
CREATE POLICY "Allow admins to delete listing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listings-images' AND is_admin(auth.uid()));

-- 7) Users can view feedback attachments (admin OR own folder)
DROP POLICY IF EXISTS "Users can view feedback attachments" ON storage.objects;
CREATE POLICY "Users can view feedback attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR is_admin(auth.uid())
  )
);
