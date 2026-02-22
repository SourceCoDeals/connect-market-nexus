
-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS public.connection_messages CASCADE;

-- =============================================
-- Connection Messages — in-platform messaging
-- =============================================
CREATE TABLE public.connection_messages (
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
CREATE INDEX idx_connection_messages_request
  ON public.connection_messages(connection_request_id, created_at);

CREATE INDEX idx_connection_messages_unread_buyer
  ON public.connection_messages(connection_request_id)
  WHERE is_read_by_buyer = false AND sender_role = 'admin';

CREATE INDEX idx_connection_messages_unread_admin
  ON public.connection_messages(connection_request_id)
  WHERE is_read_by_admin = false AND sender_role = 'buyer';

CREATE INDEX idx_connection_messages_created_desc
  ON public.connection_messages(created_at DESC);

CREATE INDEX idx_connection_messages_buyer_unread_global
  ON public.connection_messages(sender_role, is_read_by_buyer)
  WHERE sender_role = 'admin' AND is_read_by_buyer = false;

-- RLS
ALTER TABLE public.connection_messages ENABLE ROW LEVEL SECURITY;

-- Admins can read and write all messages
CREATE POLICY "Admins can manage connection messages"
  ON public.connection_messages FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Buyers can read messages on their own connection requests
CREATE POLICY "Buyers can read own request messages"
  ON public.connection_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Buyers can insert messages on their own connection requests
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

-- Buyers can mark messages as read
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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_messages;

-- Anti-tampering trigger
CREATE OR REPLACE FUNCTION fn_protect_message_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
    OR NEW.message_type IS DISTINCT FROM OLD.message_type
    OR NEW.connection_request_id IS DISTINCT FROM OLD.connection_request_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read status fields can be updated by non-admin users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_message_immutability
  BEFORE UPDATE ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_protect_message_immutability();
