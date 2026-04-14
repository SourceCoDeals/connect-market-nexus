-- ============================================================================
-- Contact Lists: Split RLS policies (idempotent reconciler)
--
-- Why this exists:
--
--   20260311000000_contact_lists.sql creates `contact_lists` and
--   `contact_list_members` with a single "FOR ALL" policy on each table.
--   That policy lacks a separate WITH CHECK clause, which caused INSERTs to
--   fail in practice.
--
--   The original fix lives in
--   20260225211326_8ed1d720-b2cf-4d45-b51f-541eb41ca924.sql — but that file
--   is timestamped BEFORE the create-table migration, so
--   `supabase db reset` on a fresh clone tries to drop policies on a table
--   that doesn't yet exist and fails with "relation … does not exist".
--
--   The Feb 25 file has been rewritten as a to_regclass()-guarded no-op
--   (see its header), and this migration — ordered immediately after the
--   create-table migration — installs the correct split policies on every
--   environment, fresh or existing.
--
-- Idempotency:
--
--   DROP POLICY IF EXISTS covers every known historical policy name (the
--   original FOR ALL plus the four split ones). CREATE POLICY then creates
--   them fresh. Re-applying this migration against an environment that
--   already has the split policies is a no-op in effect.
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Admins can read contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Admins can insert contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Admins can update contact lists" ON public.contact_lists;
DROP POLICY IF EXISTS "Admins can delete contact lists" ON public.contact_lists;

CREATE POLICY "Admins can read contact lists"
  ON public.contact_lists FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert contact lists"
  ON public.contact_lists FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update contact lists"
  ON public.contact_lists FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete contact lists"
  ON public.contact_lists FOR DELETE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage contact list members" ON public.contact_list_members;
DROP POLICY IF EXISTS "Admins can read contact list members" ON public.contact_list_members;
DROP POLICY IF EXISTS "Admins can insert contact list members" ON public.contact_list_members;
DROP POLICY IF EXISTS "Admins can update contact list members" ON public.contact_list_members;
DROP POLICY IF EXISTS "Admins can delete contact list members" ON public.contact_list_members;

CREATE POLICY "Admins can read contact list members"
  ON public.contact_list_members FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert contact list members"
  ON public.contact_list_members FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update contact list members"
  ON public.contact_list_members FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete contact list members"
  ON public.contact_list_members FOR DELETE
  USING (public.is_admin(auth.uid()));
