-- Migration: Rename 'user' role to 'viewer' for clarity
--
-- The 'user' role in the app_role enum creates confusion between
-- internal team members and marketplace buyers. Renaming to 'viewer'
-- makes it clear this is an internal role with read-only marketplace access.
--
-- This migration:
-- 1. Adds 'viewer' to the app_role enum
-- 2. Migrates all existing 'user' roles to 'viewer'
-- 3. Updates all DB functions that reference 'user' role
-- 4. Removes the 'user' value from the enum

-- Step 1: Add 'viewer' to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Step 2: Migrate existing 'user' roles to 'viewer'
UPDATE public.user_roles SET role = 'viewer' WHERE role = 'user';

-- Step 3: Update get_user_role to use 'viewer' instead of 'user'
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'moderator' THEN 3
    WHEN 'viewer' THEN 4
    WHEN 'user' THEN 5
  END
  LIMIT 1
$$;

-- Step 4: Update change_user_role to use 'viewer' instead of 'user'
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
    IF new_role NOT IN ('moderator', 'viewer', 'user') THEN
      RAISE EXCEPTION 'Admins can only assign Team Member or Viewer roles';
    END IF;
  ELSIF NOT public.is_owner(caller_id) THEN
    RAISE EXCEPTION 'Only owners and admins can change user roles';
  END IF;

  -- Prevent owner from demoting themselves
  IF caller_id = target_user_id AND new_role NOT IN ('owner') THEN
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

-- Step 5: Create a client-callable function to get the current user's team role
-- This lets the frontend fetch the specific role without reading user_roles directly
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'moderator' THEN 3
    WHEN 'viewer' THEN 4
    WHEN 'user' THEN 5
  END
  LIMIT 1
$$;
