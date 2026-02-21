-- Create private storage bucket for deal data rooms
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-data-rooms', 'deal-data-rooms', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Admins can manage all deal data room files"
ON storage.objects FOR ALL
USING (bucket_id = 'deal-data-rooms' AND is_admin(auth.uid()))
WITH CHECK (bucket_id = 'deal-data-rooms' AND is_admin(auth.uid()));

CREATE POLICY "Buyers can view granted deal files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deal-data-rooms'
  AND EXISTS (
    SELECT 1 FROM data_room_access a
    WHERE a.marketplace_user_id = auth.uid()
      AND a.revoked_at IS NULL
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND (a.can_view_teaser = true OR a.can_view_full_memo = true OR a.can_view_data_room = true)
  )
);