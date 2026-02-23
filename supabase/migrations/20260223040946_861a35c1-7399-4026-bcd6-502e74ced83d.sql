
-- Add conversation state to connection_requests for inbox routing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_state') THEN
    CREATE TYPE public.conversation_state AS ENUM (
      'new',
      'waiting_on_buyer',
      'waiting_on_admin', 
      'claimed',
      'closed'
    );
  END IF;
END $$;

-- Add conversation tracking fields to connection_requests
ALTER TABLE public.connection_requests 
  ADD COLUMN IF NOT EXISTS conversation_state text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS last_message_sender_role text,
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Add deal_owner_id to listings for deal ownership routing
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deal_owner_id uuid REFERENCES auth.users(id);

-- Create index for inbox queries
CREATE INDEX IF NOT EXISTS idx_connection_requests_conversation_state 
  ON public.connection_requests(conversation_state);
CREATE INDEX IF NOT EXISTS idx_connection_requests_last_message_at 
  ON public.connection_requests(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_listings_deal_owner_id 
  ON public.listings(deal_owner_id);

-- Create a trigger function to auto-update conversation state on new messages
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE connection_requests
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 100),
    last_message_sender_role = NEW.sender_role,
    conversation_state = CASE
      WHEN NEW.sender_role = 'buyer' THEN 'waiting_on_admin'
      WHEN NEW.sender_role = 'admin' THEN 'waiting_on_buyer'
      ELSE conversation_state
    END,
    updated_at = now()
  WHERE id = NEW.connection_request_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.connection_messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Backfill existing conversations with last message data
WITH latest_messages AS (
  SELECT DISTINCT ON (connection_request_id)
    connection_request_id,
    created_at,
    LEFT(body, 100) as preview,
    sender_role
  FROM connection_messages
  ORDER BY connection_request_id, created_at DESC
)
UPDATE connection_requests cr
SET 
  last_message_at = lm.created_at,
  last_message_preview = lm.preview,
  last_message_sender_role = lm.sender_role,
  conversation_state = CASE
    WHEN lm.sender_role = 'buyer' THEN 'waiting_on_admin'
    WHEN lm.sender_role = 'admin' THEN 'waiting_on_buyer'
    ELSE 'new'
  END
FROM latest_messages lm
WHERE cr.id = lm.connection_request_id;
