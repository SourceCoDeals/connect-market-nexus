-- Add INSERT policy for admins to send messages on connection requests
CREATE POLICY "Admins can send messages"
ON public.connection_messages
FOR INSERT
WITH CHECK (
  sender_role = 'admin'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);