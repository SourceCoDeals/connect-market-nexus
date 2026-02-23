-- Migration: Rename 'user' role to 'viewer' in user_roles table
-- This eliminates confusion between marketplace buyers (profiles.role = 'buyer')
-- and internal team members who had role = 'user' in user_roles.

-- 1. Update existing rows
UPDATE public.user_roles
SET role = 'viewer'
WHERE role = 'user';

-- 2. Replace the check constraint so 'user' is no longer valid
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'viewer'));

-- 3. Recreate get_user_role() to return 'viewer' instead of 'user' as default
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id;

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- 4. Add get_my_role() — lets the current user fetch their own role without needing
--    another user's ID.  Used by the client auth context.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 5. Update change_user_role() to validate new role set
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
BEGIN
  -- Validate the new role value
  IF _new_role NOT IN ('owner', 'admin', 'moderator', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be owner, admin, moderator, or viewer.', _new_role;
  END IF;

  -- Only owners can change roles
  SELECT role INTO _caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  IF _caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owners can change user roles';
  END IF;

  -- Upsert the role
  INSERT INTO public.user_roles (user_id, role, assigned_by, reason)
  VALUES (_target_user_id, _new_role, auth.uid(), _reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = now(),
    reason = EXCLUDED.reason;

  -- Log the change
  INSERT INTO public.permission_audit_log (user_id, changed_by, old_role, new_role, reason)
  VALUES (
    _target_user_id,
    auth.uid(),
    (SELECT role FROM public.user_roles WHERE user_id = _target_user_id),
    _new_role,
    _reason
  );
END;
$$;
