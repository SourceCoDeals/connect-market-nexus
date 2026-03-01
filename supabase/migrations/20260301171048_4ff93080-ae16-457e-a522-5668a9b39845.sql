
-- Create the message-attachments storage bucket for file uploads in deal messaging.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload attachments.
DROP POLICY IF EXISTS "Authenticated users can upload message attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload message attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

-- Attachments are publicly readable (bucket is public) so both parties can download.
DROP POLICY IF EXISTS "Anyone can read message attachments" ON storage.objects;
CREATE POLICY "Anyone can read message attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'message-attachments');
