-- ============================================================================
-- Fix: text → app_role cast for invite-team-member edge function
--
-- The invite-team-member edge function passes role values as plain text
-- strings via PostgREST, but user_roles.role and permission_audit_log columns
-- are typed as app_role enum. PostgreSQL requires an explicit cast.
--
-- This migration also:
--   - Adds implicit text→app_role cast so PostgREST inserts work
--   - Fixes user_roles unique constraint: (user_id) instead of (user_id, role)
--     since each user should have exactly one role
-- ============================================================================

-- Allow PostgreSQL to auto-cast text → app_role (fixes PostgREST inserts)
DO $$ BEGIN
  CREATE CAST (text AS app_role) WITH INOUT AS IMPLICIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fix unique constraint: one role per user
-- Remove duplicates first (keep latest)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id
  AND a.granted_at < b.granted_at;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key,
  ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

CREATE OR REPLACE FUNCTION public.assign_role_for_invite(
  _user_id uuid,
  _role text,
  _granted_by uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_role app_role;
BEGIN
  -- Validate role value
  IF _role NOT IN ('owner', 'admin', 'moderator', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be owner, admin, moderator, or viewer.', _role;
  END IF;

  -- Capture old role before upsert
  SELECT role INTO _old_role FROM public.user_roles WHERE user_id = _user_id;

  -- Upsert the role with explicit cast
  INSERT INTO public.user_roles (user_id, role, granted_by, reason)
  VALUES (_user_id, _role::app_role, _granted_by, _reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    role    = _role::app_role,
    granted_by = _granted_by,
    granted_at = now(),
    reason  = _reason;

  -- Audit log with explicit cast
  INSERT INTO public.permission_audit_log (target_user_id, changed_by, old_role, new_role, reason)
  VALUES (_user_id, _granted_by, _old_role, _role::app_role, _reason);

  -- Sync profiles.is_admin (moderator = Team Member, needs admin panel access)
  UPDATE public.profiles
  SET
    is_admin = (_role IN ('owner', 'admin', 'moderator')),
    updated_at = NOW()
  WHERE id = _user_id;
END;
$$;

-- Allow service_role (edge functions) and authenticated users to call this
GRANT EXECUTE ON FUNCTION public.assign_role_for_invite(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_role_for_invite(uuid, text, uuid, text) TO authenticated;
