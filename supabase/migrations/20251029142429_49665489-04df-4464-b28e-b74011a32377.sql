-- Fix: Create the missing auto-sync trigger
-- This ensures is_admin flag stays in sync with user_roles table

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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_is_admin_on_role_change ON public.user_roles;

CREATE TRIGGER sync_is_admin_on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_is_admin_flag();

-- Test the trigger works
COMMENT ON TRIGGER sync_is_admin_on_role_change ON public.user_roles IS 'Auto-syncs profiles.is_admin flag when user_roles changes';