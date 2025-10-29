-- Secure the permission system by making user_roles the source of truth
-- This migration updates the is_admin() function and syncs the legacy flag

-- Step 1: Replace is_admin() function to use user_roles as source of truth
-- Keep parameter name as 'user_id' to match existing function signature
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Check if user has admin or owner role in user_roles table
  -- This is now the source of truth for admin status
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
      AND role IN ('admin', 'owner')
  )
$$;

-- Step 2: Create trigger function to auto-sync is_admin flag on profiles
CREATE OR REPLACE FUNCTION public.sync_is_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- When a role is inserted or updated, sync the is_admin flag on profiles
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE public.profiles
    SET is_admin = (NEW.role IN ('admin', 'owner'))
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  -- When a role is deleted, check if user still has admin/owner from other rows
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.profiles
    SET is_admin = EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = OLD.user_id 
      AND role IN ('admin', 'owner')
    )
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Step 3: Create trigger on user_roles to auto-sync is_admin
DROP TRIGGER IF EXISTS sync_is_admin_on_role_change ON public.user_roles;
CREATE TRIGGER sync_is_admin_on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_is_admin_flag();

-- Step 4: Initial sync - update all existing profiles based on user_roles
UPDATE public.profiles p
SET is_admin = EXISTS (
  SELECT 1 
  FROM public.user_roles ur
  WHERE ur.user_id = p.id 
  AND ur.role IN ('admin', 'owner')
);

-- Step 5: Add comments explaining the system
COMMENT ON FUNCTION public.is_admin(uuid) IS 'Source of truth: Checks user_roles table for admin/owner role. The is_admin flag on profiles is auto-synced via trigger for backward compatibility with RLS policies.';

COMMENT ON COLUMN public.profiles.is_admin IS 'Legacy flag, auto-synced from user_roles table via trigger. Do not update directly. Use change_user_role() function to modify roles.';