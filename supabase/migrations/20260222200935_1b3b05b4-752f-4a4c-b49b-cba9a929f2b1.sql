
-- Migration 1: connection_messages table + RLS + indexes + realtime
CREATE TABLE IF NOT EXISTS public.connection_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_request_id UUID NOT NULL REFERENCES public.connection_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_text TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to connection_messages"
  ON public.connection_messages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Buyers can read messages on their own connection requests
CREATE POLICY "Buyers can read their connection messages"
  ON public.connection_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Buyers can insert messages on their own connection requests
CREATE POLICY "Buyers can send messages on their connections"
  ON public.connection_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.connection_requests cr
      WHERE cr.id = connection_request_id AND cr.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_connection_messages_request_id ON public.connection_messages(connection_request_id);
CREATE INDEX idx_connection_messages_sender_id ON public.connection_messages(sender_id);
CREATE INDEX idx_connection_messages_created_at ON public.connection_messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_messages;

-- Migration 2: anti-tampering trigger + additional indexes

-- Prevent message editing/deletion by non-admins
CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can modify or delete messages';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_message_update
  BEFORE UPDATE ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_tampering();

CREATE TRIGGER prevent_message_delete
  BEFORE DELETE ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_tampering();

-- Additional composite index for unread messages
CREATE INDEX idx_connection_messages_unread ON public.connection_messages(connection_request_id, read_at) WHERE read_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER update_connection_messages_updated_at
  BEFORE UPDATE ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
