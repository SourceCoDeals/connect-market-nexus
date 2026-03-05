-- ============================================================================
-- Fix: Listings INSERT policy uses has_role('admin') but should use is_admin()
-- ============================================================================
-- The "Admins can insert listings" policy (from 20260304184729) uses
-- has_role(auth.uid(), 'admin') which only matches the exact 'admin' role.
--
-- But the SELECT policy uses is_admin(auth.uid()) which matches 'admin',
-- 'owner', AND 'moderator' roles.
--
-- This mismatch means owners and moderators can VIEW the SourceCo Deals page
-- but CANNOT add new deals — the insert silently fails with an RLS violation.
--
-- Fix: Replace has_role(uid, 'admin') with is_admin(uid) to match the
-- SELECT policy and allow all admin-level roles to insert listings.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert listings" ON public.listings;

CREATE POLICY "Admins can insert listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
