
-- Security: Enforce sender_role server-side based on user_roles table
-- This trigger overrides client-provided sender_role with the actual role from user_roles
CREATE OR REPLACE FUNCTION public.fn_enforce_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin via user_roles table
  IF public.is_admin(NEW.sender_id) THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'buyer';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger before insert on connection_messages
DROP TRIGGER IF EXISTS trg_enforce_sender_role ON public.connection_messages;
CREATE TRIGGER trg_enforce_sender_role
  BEFORE INSERT ON public.connection_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_sender_role();
