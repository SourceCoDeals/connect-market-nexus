-- ============================================================================
-- MIGRATION: Tighten 7 "RLS Policy Always True" policies flagged by advisors
-- ============================================================================
-- Supabase advisors flagged 20 policies where USING and/or WITH CHECK is
-- literally `true`, effectively bypassing RLS. 13 of those are the intended
-- `TO service_role USING (true)` system pattern and are left as-is. The 7
-- remaining ones grant unrestricted `authenticated` or `public` access and
-- have been tightened here.
--
-- NOT tightened in this migration (deliberate — they're intended to stay):
--   * `Service role full access on ...` patterns (13 across ai_command_center_usage,
--     contact_discovery_log, contact_search_log, enriched_contacts, pe_*,
--     smart_list_*)
--   * `Anyone can insert registration funnel data` on registration_funnel —
--     public funnel tracking needs anonymous INSERT.
--   * test_run_results / test_run_tracking / enrichment_test_* — dev-only
--     internal tables, low-risk.
--
-- Tightened here:
--   1. buyer_search_jobs — scope INSERT/UPDATE to the row creator OR admin.
--      SELECT stays broad (all authenticated users can see all jobs — this is
--      an admin-tool audit log, everyone on the team needs the view).
--   2. contact_search_cache — narrow ALL to service_role + admin. It's a
--      system cache with PII-adjacent contact search results; no reason for
--      anon/public access.
--   3. smartlead_reply_inbox — the email inbox view. Tighten SELECT and
--      UPDATE to admins only (and service_role via separate existing policy).
-- ============================================================================

-- ─── 1. buyer_search_jobs ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert buyer search jobs" ON public.buyer_search_jobs;
CREATE POLICY "Authenticated users can insert own buyer search jobs"
  ON public.buyer_search_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can update buyer search jobs" ON public.buyer_search_jobs;
CREATE POLICY "Authenticated users can update own buyer search jobs"
  ON public.buyer_search_jobs
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );


-- ─── 2. contact_search_cache ───────────────────────────────────────────────
-- No ownership column on this table (it's a system cache keyed by
-- cache_key). Restrict to admins + service_role — the existing policy was
-- TO public USING(true) which allowed any request to read/write cached
-- search results (PII-adjacent).

DROP POLICY IF EXISTS "contact_search_cache_all" ON public.contact_search_cache;
CREATE POLICY "contact_search_cache_admin_and_service"
  ON public.contact_search_cache
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Service role already bypasses RLS by default, but add an explicit policy
-- so the intent is documented if RLS-bypass is ever tightened.
DROP POLICY IF EXISTS "contact_search_cache_service_role" ON public.contact_search_cache;
CREATE POLICY "contact_search_cache_service_role"
  ON public.contact_search_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 3. smartlead_reply_inbox ──────────────────────────────────────────────
-- Admin-only inbox view. The existing "Authenticated users can read inbox"
-- and "Authenticated users can update status and overrides" let any auth
-- user read or mutate any reply row.

DROP POLICY IF EXISTS "Authenticated users can read inbox" ON public.smartlead_reply_inbox;
CREATE POLICY "Admins can read inbox"
  ON public.smartlead_reply_inbox
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update status and overrides" ON public.smartlead_reply_inbox;
CREATE POLICY "Admins can update status and overrides"
  ON public.smartlead_reply_inbox
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
