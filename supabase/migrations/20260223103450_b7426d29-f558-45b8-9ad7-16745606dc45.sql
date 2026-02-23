-- Update the enforce_sender_role trigger to allow system messages with null sender_id
CREATE OR REPLACE FUNCTION public.fn_enforce_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow system messages (no sender) to keep their provided sender_role
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if user is admin via user_roles table
  IF public.is_admin(NEW.sender_id) THEN
    NEW.sender_role := 'admin';
  ELSE
    NEW.sender_role := 'buyer';
  END IF;
  RETURN NEW;
END;
$$;