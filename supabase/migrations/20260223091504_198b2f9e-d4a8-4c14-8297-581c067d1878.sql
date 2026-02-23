-- Drop old check constraint if exists, add new one
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role::text IN ('owner', 'admin', 'moderator', 'viewer'));

-- Recreate get_user_role() to return 'viewer' as default
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role::text INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id;

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- Add get_my_role() for client auth context
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role::text INTO _role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  RETURN COALESCE(_role, 'viewer');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Update change_user_role() with new role validation
CREATE OR REPLACE FUNCTION public.change_user_role(
  _target_user_id uuid,
  _new_role text,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role text;
  _old_role text;
BEGIN
  IF _new_role NOT IN ('owner', 'admin', 'moderator', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be owner, admin, moderator, or viewer.', _new_role;
  END IF;

  SELECT role::text INTO _caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF _caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can change user roles';
  END IF;

  -- Get old role for audit log
  SELECT role::text INTO _old_role
  FROM public.user_roles
  WHERE user_id = _target_user_id;

  -- Upsert the role
  INSERT INTO public.user_roles (user_id, role, granted_by, reason)
  VALUES (_target_user_id, _new_role::public.app_role, auth.uid(), _reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    granted_by = EXCLUDED.granted_by,
    reason = EXCLUDED.reason;

  -- Log the change
  INSERT INTO public.permission_audit_log (target_user_id, changed_by, old_role, new_role, reason)
  VALUES (
    _target_user_id,
    auth.uid(),
    _old_role,
    _new_role,
    _reason
  );
END;
$$;