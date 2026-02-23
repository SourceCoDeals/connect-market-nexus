-- Migration 3 (cleaned): Role Constraint + get_my_role()
-- The enum already has 'viewer', no 'user' rows exist. Just add constraint + functions.

-- Replace the check constraint
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'viewer'));

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
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id;

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- Add get_my_role()
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

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;