-- ============================================================================
-- NO-OP / IDEMPOTENT RECONCILER
--
-- History: This migration originally dropped the "Admins can manage contact
-- lists" FOR ALL policy (introduced by 20260311000000_contact_lists.sql) and
-- replaced it with split SELECT/INSERT/UPDATE/DELETE policies, because the
-- original FOR ALL policy lacked WITH CHECK and caused INSERTs to fail.
--
-- Problem: This migration's timestamp (20260225…) is BEFORE the timestamp of
-- the migration that creates the `contact_lists` table (20260311…). On a
-- fresh environment (`supabase db reset`), this file would execute first and
-- fail with "relation \"contact_lists\" does not exist".
--
-- Fix: The split policies have been inlined directly into
-- 20260311000000_contact_lists.sql (the table-creation migration), so this
-- file's original purpose is obsolete for fresh clones.
--
-- For existing production/staging environments that already executed the
-- original version of this file, the split policies are already in place and
-- this file is recorded as applied — Supabase will not re-run it.
--
-- For historical consistency, this file now contains an idempotent reconciler
-- wrapped in a to_regclass() guard so that:
--   * Fresh clones: `contact_lists` does not yet exist → guard is false →
--     the DO block is a true no-op and the migration succeeds.
--   * Existing environments: already recorded as applied → never re-executed.
--   * Out-of-order reapplies (unlikely): guard is true → idempotent DROP +
--     CREATE brings the policy set back to the canonical split state.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.contact_lists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage contact lists" ON public.contact_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read contact lists" ON public.contact_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert contact lists" ON public.contact_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update contact lists" ON public.contact_lists';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete contact lists" ON public.contact_lists';

    EXECUTE 'CREATE POLICY "Admins can read contact lists" ON public.contact_lists FOR SELECT USING (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can insert contact lists" ON public.contact_lists FOR INSERT WITH CHECK (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can update contact lists" ON public.contact_lists FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can delete contact lists" ON public.contact_lists FOR DELETE USING (public.is_admin(auth.uid()))';
  END IF;

  IF to_regclass('public.contact_list_members') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage contact list members" ON public.contact_list_members';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can read contact list members" ON public.contact_list_members';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert contact list members" ON public.contact_list_members';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update contact list members" ON public.contact_list_members';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete contact list members" ON public.contact_list_members';

    EXECUTE 'CREATE POLICY "Admins can read contact list members" ON public.contact_list_members FOR SELECT USING (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can insert contact list members" ON public.contact_list_members FOR INSERT WITH CHECK (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can update contact list members" ON public.contact_list_members FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY "Admins can delete contact list members" ON public.contact_list_members FOR DELETE USING (public.is_admin(auth.uid()))';
  END IF;
END $$;
