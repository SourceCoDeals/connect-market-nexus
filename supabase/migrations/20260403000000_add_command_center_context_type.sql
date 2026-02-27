-- Add 'command_center' to the allowed context_type values for chat_conversations
-- This supports the AI Command Center's conversation history feature.

DO $$
BEGIN
  -- Drop the old check constraint if it exists, then re-add with new value
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_conversations_context_type_check'
      AND table_name = 'chat_conversations'
  ) THEN
    ALTER TABLE public.chat_conversations DROP CONSTRAINT chat_conversations_context_type_check;
  END IF;

  ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_context_type_check
    CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe', 'command_center'));
END $$;
