-- Phase 1: Enhanced Metrics Grid
-- Add customizable metric fields to listings table
ALTER TABLE listings
ADD COLUMN custom_metric_label TEXT,
ADD COLUMN custom_metric_value TEXT,
ADD COLUMN custom_metric_subtitle TEXT,
ADD COLUMN metric_3_type TEXT DEFAULT 'employees',
ADD COLUMN metric_3_custom_label TEXT,
ADD COLUMN metric_3_custom_value TEXT,
ADD COLUMN metric_3_custom_subtitle TEXT,
ADD COLUMN revenue_metric_subtitle TEXT,
ADD COLUMN ebitda_metric_subtitle TEXT;

-- Phase 2: Deal Advisor
-- Add presented_by admin reference
ALTER TABLE listings
ADD COLUMN presented_by_admin_id UUID REFERENCES profiles(id);

-- Phase 3: Buyer-Admin Chat
-- Create listing_conversations table
CREATE TABLE listing_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  connection_request_id UUID NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  admin_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_request_id)
);

-- Create listing_messages table
CREATE TABLE listing_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES listing_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('buyer', 'admin')),
  message_text TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE listing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listing_conversations
CREATE POLICY "Buyers can view their own conversations"
  ON listing_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON listing_conversations FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage conversations"
  ON listing_conversations FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for listing_messages
CREATE POLICY "Buyers can view their own messages"
  ON listing_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listing_conversations
      WHERE listing_conversations.id = listing_messages.conversation_id
      AND listing_conversations.user_id = auth.uid()
    )
    AND is_internal_note = false
  );

CREATE POLICY "Admins can view all messages"
  ON listing_messages FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can send messages in their conversations"
  ON listing_messages FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM listing_conversations
        WHERE listing_conversations.id = conversation_id
        AND listing_conversations.user_id = auth.uid()
      )
      AND sender_id = auth.uid()
      AND sender_type = 'buyer'
      AND is_internal_note = false
    )
    OR
    (
      is_admin(auth.uid())
      AND sender_id = auth.uid()
      AND sender_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete messages"
  ON listing_messages FOR DELETE
  USING (is_admin(auth.uid()));

-- Auto-create conversation on connection approval
CREATE OR REPLACE FUNCTION create_listing_conversation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create conversation if status changed to approved and conversation doesn't exist
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO listing_conversations (
      listing_id,
      connection_request_id,
      user_id,
      admin_id
    )
    VALUES (
      NEW.listing_id,
      NEW.id,
      NEW.user_id,
      NEW.approved_by
    )
    ON CONFLICT (connection_request_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_connection_approved_create_conversation
  AFTER UPDATE ON connection_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION create_listing_conversation();

-- Indexes for performance
CREATE INDEX idx_listing_conversations_user ON listing_conversations(user_id);
CREATE INDEX idx_listing_conversations_listing ON listing_conversations(listing_id);
CREATE INDEX idx_listing_messages_conversation ON listing_messages(conversation_id);
CREATE INDEX idx_listing_messages_created ON listing_messages(created_at DESC);