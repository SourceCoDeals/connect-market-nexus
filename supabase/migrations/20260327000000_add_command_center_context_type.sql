-- Add 'command_center' to chat_conversations context_type CHECK constraint
-- so the AI Command Center can persist conversation threads.

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_context_type_check;

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_context_type_check
  CHECK (context_type IN ('deal', 'deals', 'buyers', 'universe', 'command_center'));
