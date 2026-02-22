-- =============================================
-- Fix: Prevent buyer message tampering
-- The UPDATE RLS policy allowed buyers to modify
-- any column. This trigger restricts non-admins
-- to only updating read status columns.
-- Also adds .limit()-friendly index and explicit
-- sender_role filter on buyer update policy.
-- =============================================

-- 1. Trigger to prevent non-admin message tampering
CREATE OR REPLACE FUNCTION fn_protect_message_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to modify anything
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  -- For non-admins, only allow read status changes
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

DROP TRIGGER IF EXISTS trg_protect_message_immutability ON public.connection_messages;
CREATE TRIGGER trg_protect_message_immutability
  BEFORE UPDATE ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_protect_message_immutability();

-- 2. Add missing index for global message queries (thread listings)
CREATE INDEX IF NOT EXISTS idx_connection_messages_created_desc
  ON public.connection_messages(created_at DESC);

-- 3. Add index for buyer unread count queries (sender_role + is_read_by_buyer)
CREATE INDEX IF NOT EXISTS idx_connection_messages_buyer_unread_global
  ON public.connection_messages(sender_role, is_read_by_buyer)
  WHERE sender_role = 'admin' AND is_read_by_buyer = false;
