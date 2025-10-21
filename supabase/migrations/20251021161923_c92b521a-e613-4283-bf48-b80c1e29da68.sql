-- Step 1: Rename assigned_at to granted_at for consistency
ALTER TABLE public.user_roles RENAME COLUMN assigned_at TO granted_at;
ALTER TABLE public.user_roles RENAME COLUMN assigned_by TO granted_by;

-- Step 2: Clear all existing roles to start fresh
DELETE FROM public.user_roles;

-- Step 3: Insert owner role for ahaile14@gmail.com
INSERT INTO public.user_roles (user_id, role, granted_by, reason)
SELECT 
  id,
  'owner'::app_role,
  NULL,
  'Primary owner - system initialization'
FROM auth.users
WHERE email = 'ahaile14@gmail.com';

-- Step 4: Migrate all other admin users to 'admin' role
INSERT INTO public.user_roles (user_id, role, granted_by, reason)
SELECT 
  p.id,
  'admin'::app_role,
  (SELECT id FROM auth.users WHERE email = 'ahaile14@gmail.com'),
  'Migrated from is_admin field'
FROM public.profiles p
WHERE p.is_admin = true
  AND p.id != (SELECT id FROM auth.users WHERE email = 'ahaile14@gmail.com');

-- Step 5: Create get_all_user_roles RPC for secure role fetching
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
  -- Only owner can view all roles
  IF NOT public.is_owner(auth.uid()) THEN
    -- Non-owners get empty result
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
  ORDER BY ur.granted_at DESC;
END;
$$;

-- Step 6: Add RLS policies for user_roles table
DROP POLICY IF EXISTS "Owner can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Owner can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Step 7: Update change_user_role to use granted_at/granted_by
CREATE OR REPLACE FUNCTION public.change_user_role(target_user_id uuid, new_role app_role, change_reason text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  caller_id UUID;
  old_role public.app_role;
  target_email TEXT;
BEGIN
  -- Get caller ID
  caller_id := auth.uid();
  
  -- Check if caller is owner
  IF NOT public.is_owner(caller_id) THEN
    RAISE EXCEPTION 'Only owners can change user roles';
  END IF;
  
  -- Prevent owner from demoting themselves
  IF caller_id = target_user_id AND new_role != 'owner' THEN
    RAISE EXCEPTION 'Owners cannot demote themselves';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  
  -- Prevent changing the owner role of ahaile14@gmail.com
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
  
  -- Insert new role with granted_at/granted_by
  INSERT INTO public.user_roles (user_id, role, granted_by, reason)
  VALUES (target_user_id, new_role, caller_id, change_reason);
  
  -- Log the change
  INSERT INTO public.permission_audit_log (
    target_user_id,
    changed_by,
    old_role,
    new_role,
    reason
  ) VALUES (
    target_user_id,
    caller_id,
    old_role,
    new_role,
    change_reason
  );
  
  -- Sync with profiles table for backward compatibility
  UPDATE public.profiles
  SET 
    is_admin = (new_role IN ('owner', 'admin')),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$function$;