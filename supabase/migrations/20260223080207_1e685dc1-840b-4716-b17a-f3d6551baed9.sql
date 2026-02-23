
-- Fix 1: Add missing user_roles entry for oz.delaluna@sourcecodeals.com
INSERT INTO public.user_roles (user_id, role, granted_by, reason)
SELECT 'ea1f0064-52ef-43fb-bec4-22391b720328', 'admin', 'c4fd2774-3b19-4b7c-b06e-a9a08f73331b', 'Fix: orphaned is_admin flag without user_roles entry'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'ea1f0064-52ef-43fb-bec4-22391b720328'
);

-- Fix 2: Update change_user_role to protect ALL owners dynamically, not just hardcoded email
CREATE OR REPLACE FUNCTION public.change_user_role(
  target_user_id UUID,
  new_role public.app_role,
  change_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_role public.app_role;
  old_role public.app_role;
  target_email TEXT;
  target_current_role public.app_role;
BEGIN
  caller_id := auth.uid();
  caller_role := public.get_user_role(caller_id);

  -- Only owners and admins can change roles
  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can change user roles';
  END IF;

  -- Admins can only assign moderator or user roles
  IF caller_role = 'admin' THEN
    IF new_role NOT IN ('moderator', 'user') THEN
      RAISE EXCEPTION 'Admins can only assign Team Member or User roles';
    END IF;
  END IF;

  -- Get target's current role
  target_current_role := public.get_user_role(target_user_id);

  -- Prevent demoting any existing owner (only another owner can change an owner, and not to a lower role)
  IF target_current_role = 'owner' AND new_role != 'owner' THEN
    -- Only allow if the caller is a different owner
    IF caller_id = target_user_id THEN
      RAISE EXCEPTION 'Owners cannot demote themselves';
    END IF;
    -- Even other owners cannot demote owners — must be done at DB level
    RAISE EXCEPTION 'Cannot demote an owner. This must be changed at the database level.';
  END IF;

  -- Only owners can promote to owner
  IF new_role = 'owner' AND caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can promote users to owner';
  END IF;

  -- Admins cannot modify other admins or owners
  IF caller_role = 'admin' AND target_current_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Admins cannot modify other admins or owners';
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  old_role := target_current_role;

  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  INSERT INTO public.user_roles (user_id, role, granted_by, reason)
  VALUES (target_user_id, new_role, caller_id, change_reason);

  INSERT INTO public.permission_audit_log (
    target_user_id, changed_by, old_role, new_role, reason
  ) VALUES (
    target_user_id, caller_id, old_role, new_role, change_reason
  );

  UPDATE public.profiles
  SET
    is_admin = (new_role IN ('owner', 'admin', 'moderator')),
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;
