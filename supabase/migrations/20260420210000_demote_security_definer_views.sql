-- ============================================================================
-- MIGRATION: Demote 15 SECURITY DEFINER views to SECURITY INVOKER
-- ============================================================================
-- Supabase advisors flag these 15 views as ERROR-level because they run with
-- the view-owner's permissions instead of the caller's, effectively bypassing
-- RLS on their underlying tables. Postgres 15+ supports per-view
-- `security_invoker = true` to force the caller's role, which is the
-- non-surprising default and what all consumers of these views expect.
--
-- Underlying tables all have RLS enabled with appropriate admin /
-- service-role policies, so admin UI callsites continue to see what they
-- need (via the is_admin() branches in each table's RLS). If any view turns
-- out to have been accidentally relying on the DEFINER elevation for a
-- non-admin caller, that caller's access falls through to the table-level
-- RLS — which is the correct behavior.
--
-- Reversal, if a regression appears: `ALTER VIEW ... SET (security_invoker = false)`.
-- ============================================================================

ALTER VIEW public.admin_connection_requests_views_v2 SET (security_invoker = true);
ALTER VIEW public.admin_deal_sourcing_views_v2       SET (security_invoker = true);
ALTER VIEW public.admin_owner_leads_views_v2         SET (security_invoker = true);
ALTER VIEW public.admin_users_views_v2               SET (security_invoker = true);
ALTER VIEW public.buyer_introduction_summary         SET (security_invoker = true);
ALTER VIEW public.introduced_and_passed_buyers       SET (security_invoker = true);
ALTER VIEW public.marketplace_listings               SET (security_invoker = true);
ALTER VIEW public.remarketing_buyer_universes        SET (security_invoker = true);
ALTER VIEW public.remarketing_buyers                 SET (security_invoker = true);
ALTER VIEW public.unified_contact_timeline           SET (security_invoker = true);
ALTER VIEW public.v_campaign_outreach_stats          SET (security_invoker = true);
ALTER VIEW public.v_contact_outreach_summary         SET (security_invoker = true);
ALTER VIEW public.v_deals_exceeding_sla              SET (security_invoker = true);
ALTER VIEW public.v_duplicate_buyers                 SET (security_invoker = true);
ALTER VIEW public.v_firm_outreach_summary            SET (security_invoker = true);
