-- Migration: Rename 'user' enum value to 'viewer' in the app_role enum
--
-- The 'user' value is ambiguous: marketplace buyers are also "users".
-- 'viewer' clearly indicates an internal team member with read-only access.
--
-- PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE.

-- 1. Rename the enum value (no data update needed — existing rows update automatically)
ALTER TYPE public.app_role RENAME VALUE 'user' TO 'viewer';

-- 2. Update change_user_role() — the version from 20260224100000 references 'user'
--    in the admin-can-only-assign check. Replace with 'viewer'.
CREATE OR REPLACE FUNCTION public.change_user_role(
  target_user_id uuid,
  new_role app_role,
  change_reason text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  caller_id UUID;
  caller_role public.app_role;
  old_role public.app_role;
  target_email TEXT;
BEGIN
  caller_id := auth.uid();
  caller_role := public.get_user_role(caller_id);

  -- Admin can assign moderator or viewer role; owner can assign any role
  IF caller_role = 'admin' THEN
    IF new_role NOT IN ('moderator', 'viewer') THEN
      RAISE EXCEPTION 'Admins can only assign Team Member or Viewer roles';
    END IF;
  ELSIF NOT public.is_owner(caller_id) THEN
    RAISE EXCEPTION 'Only owners and admins can change user roles';
  END IF;

  -- Prevent owner from demoting themselves
  IF caller_id = target_user_id AND new_role != 'owner' THEN
    RAISE EXCEPTION 'Owners cannot demote themselves';
  END IF;

  -- Get target user email
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;

  -- Prevent changing the primary owner
  IF target_email = 'ahaile14@gmail.com' AND new_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role of the primary owner';
  END IF;

  -- Prevent creating multiple owners
  IF new_role = 'owner' AND target_email != 'ahaile14@gmail.com' THEN
    RAISE EXCEPTION 'Only ahaile14@gmail.com can have the owner role';
  END IF;

  -- Get old role
  old_role := public.get_user_role(target_user_id);

  -- Delete existing roles for this user
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  -- Insert new role
  INSERT INTO public.user_roles (user_id, role, granted_by, reason)
  VALUES (target_user_id, new_role, caller_id, change_reason);

  -- Log the change
  INSERT INTO public.permission_audit_log (
    target_user_id, changed_by, old_role, new_role, reason
  ) VALUES (
    target_user_id, caller_id, old_role, new_role, change_reason
  );

  -- Sync with profiles.is_admin for backward compatibility
  -- moderator (Team Member) ALSO gets is_admin=true so they can enter admin panel
  UPDATE public.profiles
  SET
    is_admin = (new_role IN ('owner', 'admin', 'moderator')),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$function$;

-- 3. Update get_user_role() to default to 'viewer' instead of 'user'
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id;

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- 4. Add get_my_role() — lets the current user fetch their own role
--    without needing another user's ID. Used by the client auth context.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = auth.uid();

  RETURN COALESCE(_role, 'viewer');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
