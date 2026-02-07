-- Chat Conversations Persistence
-- Stores chat conversation history for user sessions

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Context
  context_type TEXT NOT NULL CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe')),
  deal_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES public.remarketing_buyer_universes(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT, -- Optional user-provided or auto-generated title
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {role, content, timestamp}

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  message_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED,

  -- Soft delete
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations(user_id) WHERE archived = FALSE;
CREATE INDEX idx_chat_conversations_deal_id ON public.chat_conversations(deal_id) WHERE deal_id IS NOT NULL AND archived = FALSE;
CREATE INDEX idx_chat_conversations_universe_id ON public.chat_conversations(universe_id) WHERE universe_id IS NOT NULL AND archived = FALSE;
CREATE INDEX idx_chat_conversations_updated_at ON public.chat_conversations(updated_at DESC) WHERE archived = FALSE;
CREATE INDEX idx_chat_conversations_context_type ON public.chat_conversations(context_type) WHERE archived = FALSE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_message_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversations_updated_at();

-- RLS Policies
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.chat_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can create own conversations"
  ON public.chat_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON public.chat_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (archive) their own conversations
CREATE POLICY "Users can delete own conversations"
  ON public.chat_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "Admins have full access"
  ON public.chat_conversations
  FOR ALL
  USING (is_admin(auth.uid()));

-- Comments
COMMENT ON TABLE public.chat_conversations IS 'Stores chat conversation history for buyer/deal analysis sessions';
COMMENT ON COLUMN public.chat_conversations.messages IS 'JSONB array of message objects: [{role: "user"|"assistant", content: string, timestamp: ISO8601}]';
COMMENT ON COLUMN public.chat_conversations.context_type IS 'Type of chat context: deal (single deal), deals (all deals), buyers (all buyers), universe (specific universe)';
COMMENT ON COLUMN public.chat_conversations.message_count IS 'Auto-computed count of messages in the conversation';
