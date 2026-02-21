-- ============================================================================
-- Fix: Moderator is_admin flag & Audit log policy integrity
--
-- CRITICAL fixes:
--   1. is_admin() function must include 'moderator' role
--      Without this, RLS policies using is_admin() exclude moderators
--   2. sync_is_admin_flag() trigger must include 'moderator' role
--      Without this, the trigger overwrites the correct is_admin=true
--      set by change_user_role() back to false for moderators
--   3. permission_audit_log INSERT policy must enforce changed_by = auth.uid()
--      Without this, admins can forge audit entries with arbitrary changed_by
-- ============================================================================

-- ─── 1. Fix is_admin() to include moderator ───
-- Moderators need admin panel access, so is_admin() must return true for them.
-- This function is used by RLS policies across the system.

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
      AND role IN ('admin', 'owner', 'moderator')
  )
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Source of truth: Checks user_roles table for admin/owner/moderator role. The is_admin flag on profiles is auto-synced via trigger for backward compatibility with RLS policies.';

-- ─── 2. Fix sync_is_admin_flag() trigger to include moderator ───
-- Previously: trigger set is_admin = (role IN ('admin', 'owner'))
-- This FOUGHT with change_user_role() which correctly set is_admin=true for moderator.
-- The trigger fired AFTER the function's UPDATE and overwrote it back to false.

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
    SET is_admin = (NEW.role IN ('admin', 'owner', 'moderator'))
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;

  -- When a role is deleted, check if user still has an admin-level role
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.profiles
    SET is_admin = EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = OLD.user_id
      AND role IN ('admin', 'owner', 'moderator')
    )
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

-- ─── 3. Fix permission_audit_log INSERT policy ───
-- Old policy: WITH CHECK (is_admin(auth.uid()))
-- Problem: Any admin could insert entries with forged changed_by values,
-- undermining the integrity of the audit trail.
-- Fix: Enforce that changed_by matches the authenticated user.

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.permission_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.permission_audit_log;

CREATE POLICY "Admins can insert audit logs"
ON public.permission_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  AND changed_by = auth.uid()
);

-- ============================================================================
-- Summary:
--   is_admin() now returns true for moderator role
--   sync_is_admin_flag() trigger no longer overwrites moderator's is_admin=true
--   permission_audit_log INSERT policy enforces changed_by = auth.uid()
-- ============================================================================
