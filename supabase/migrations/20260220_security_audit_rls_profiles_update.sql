-- Security Audit Fix: Add RLS UPDATE policies for profiles table
-- CRITICAL: Previously, no UPDATE policy existed on profiles, meaning any authenticated
-- user could directly update is_admin, approval_status, email_verified, and role fields
-- via the Supabase client, bypassing client-side protections.

-- ============================================================================
-- PART 1: RLS UPDATE policy for profiles — users can update own profile
-- but CANNOT modify privileged fields (is_admin, approval_status, email_verified, role, email)
-- ============================================================================

-- Drop any existing update policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile (protected fields)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Users can update their own profile, but privileged fields must remain unchanged
CREATE POLICY "Users can update own profile (protected fields)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Prevent privilege escalation: these fields must not change via user UPDATE
  AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
  AND approval_status IS NOT DISTINCT FROM (SELECT p.approval_status FROM public.profiles p WHERE p.id = auth.uid())
  AND email_verified IS NOT DISTINCT FROM (SELECT p.email_verified FROM public.profiles p WHERE p.id = auth.uid())
  AND email IS NOT DISTINCT FROM (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
);

-- Admins can update any profile (including privileged fields)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));
