-- ============================================================================
-- Internal Team Page - Role System Updates
--
-- Updates:
--   1. get_all_user_roles() - Allow admin access (not just owner)
--   2. change_user_role() - Sync is_admin=true for moderator role too
--      (moderator = Team Member, needs admin panel access)
--   3. Allow admins to assign 'moderator' role (not just owner)
-- ============================================================================

-- ─── 1. Update get_all_user_roles to allow admin access ───
-- Previously: only owner could call this
-- Now: admin and owner can see all roles (needed for Internal Team page)

CREATE OR REPLACE FUNCTION public.get_all_user_roles()
RETURNS TABLE(
  user_id uuid,
  role app_role,
  granted_at timestamp with time zone,
  granted_by uuid,
  user_email text,
  user_first_name text,
  user_last_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner or admin can view all roles
  IF NOT (public.is_owner(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    ur.role,
    ur.granted_at,
    ur.granted_by,
    au.email as user_email,
    p.first_name as user_first_name,
    p.last_name as user_last_name
  FROM public.user_roles ur
  LEFT JOIN auth.users au ON ur.user_id = au.id
  LEFT JOIN public.profiles p ON ur.user_id = p.id
  ORDER BY
    CASE ur.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'moderator' THEN 3
      ELSE 4
    END,
    ur.granted_at DESC;
END;
$$;

-- ─── 2. Update change_user_role to handle moderator correctly ───
-- Key changes:
--   a) Admin can assign 'moderator' role (not just owner)
--   b) is_admin synced for moderator too (they need admin panel access)
--   c) Owner-only operations remain owner-only (assigning admin/owner roles)

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

  -- Admin can assign moderator role; owner can assign any role
  IF caller_role = 'admin' THEN
    -- Admins can only assign 'moderator' or 'user' roles
    IF new_role NOT IN ('moderator', 'user') THEN
      RAISE EXCEPTION 'Admins can only assign Team Member or User roles';
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

-- ─── 3. Update RLS on user_roles to allow admin read access ───

DROP POLICY IF EXISTS "Owner can manage all roles" ON public.user_roles;

CREATE POLICY "Owner and admin can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
);

CREATE POLICY "Owner can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- ============================================================================
-- Summary:
--   get_all_user_roles() now accessible by admin (not just owner)
--   change_user_role() now allows admin to assign 'moderator' role
--   change_user_role() now syncs is_admin=true for moderator role
--   RLS updated: admin can read user_roles table
-- ============================================================================
