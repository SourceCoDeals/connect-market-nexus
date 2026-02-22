-- =============================================
-- Connection Messages — in-platform messaging
-- between admins and buyers on connection requests
-- =============================================

CREATE TABLE IF NOT EXISTS public.connection_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_request_id UUID NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'buyer')),
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'decision', 'system')),
  is_read_by_buyer BOOLEAN NOT NULL DEFAULT false,
  is_read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connection_messages_request
  ON public.connection_messages(connection_request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_connection_messages_unread_buyer
  ON public.connection_messages(connection_request_id)
  WHERE is_read_by_buyer = false AND sender_role = 'admin';

CREATE INDEX IF NOT EXISTS idx_connection_messages_unread_admin
  ON public.connection_messages(connection_request_id)
  WHERE is_read_by_admin = false AND sender_role = 'buyer';

-- RLS
ALTER TABLE public.connection_messages ENABLE ROW LEVEL SECURITY;

-- Admins can read and write all messages
DROP POLICY IF EXISTS "Admins can manage connection messages" ON public.connection_messages;
CREATE POLICY "Admins can manage connection messages"
  ON public.connection_messages FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Buyers can read messages on their own connection requests
DROP POLICY IF EXISTS "Buyers can read own request messages" ON public.connection_messages;
CREATE POLICY "Buyers can read own request messages"
  ON public.connection_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Buyers can insert messages on their own connection requests
DROP POLICY IF EXISTS "Buyers can send messages on own requests" ON public.connection_messages;
CREATE POLICY "Buyers can send messages on own requests"
  ON public.connection_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'buyer'
    AND EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Buyers can update read status on their own messages
DROP POLICY IF EXISTS "Buyers can mark messages as read" ON public.connection_messages;
CREATE POLICY "Buyers can mark messages as read"
  ON public.connection_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_messages;
