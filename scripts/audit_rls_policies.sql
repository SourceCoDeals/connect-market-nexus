-- ═══════════════════════════════════════════════════════════════
-- SOURCECO RLS POLICY AUDIT
-- ═══════════════════════════════════════════════════════════════
-- Run in the Supabase SQL Editor to verify Row Level Security
-- is properly configured on all critical tables.
--
-- Usage:
--   Paste into Supabase SQL Editor → Run
--   OR: psql "$DATABASE_URL" -f scripts/audit_rls_policies.sql
--
-- Generated: 2026-02-27
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Tables WITH RLS enabled ─────────────────────────────────
-- Shows all public tables and whether RLS is on or off.

SELECT
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS rls_status,
  CASE WHEN c.relforcerowsecurity THEN '🔒 FORCED' ELSE '' END AS force_rls,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity DESC, c.relname;


-- ─── 2. Critical tables that MUST have RLS ──────────────────────
-- These contain PII, financial data, or user-facing content.

SELECT
  t.critical_table,
  CASE WHEN c.relrowsecurity THEN '✅ PASS' ELSE '❌ FAIL — RLS DISABLED' END AS status,
  COALESCE((SELECT count(*) FROM pg_policies p WHERE p.tablename = t.critical_table AND p.schemaname = 'public'), 0) AS policy_count
FROM (VALUES
  ('profiles'),
  ('listings'),
  ('connection_requests'),
  ('connection_messages'),
  ('contacts'),
  ('remarketing_buyers'),
  ('firm_agreements'),
  ('deals'),
  ('chat_conversations'),
  ('chat_messages'),
  ('chat_analytics'),
  ('email_delivery_logs'),
  ('admin_notifications'),
  ('feedback_messages'),
  ('user_sessions'),
  ('page_views'),
  ('user_events'),
  ('saved_listings'),
  ('deal_tasks'),
  ('deal_activities'),
  ('deal_notes'),
  ('deal_comments'),
  ('deal_memos'),
  ('data_room_access'),
  ('documents'),
  ('enrichment_queue'),
  ('enriched_contacts'),
  ('buyer_enrichment_queue'),
  ('contact_activities'),
  ('phoneburner_webhooks_log'),
  ('smartlead_webhook_events'),
  ('smartlead_campaigns'),
  ('smartlead_campaign_leads'),
  ('heyreach_campaigns'),
  ('heyreach_campaign_leads'),
  ('captarget_sync_log'),
  ('captarget_sync_exclusions'),
  ('valuation_leads'),
  ('inbound_leads'),
  ('referral_emails'),
  ('listing_conversations'),
  ('nda_logs'),
  ('remarketing_scores')
) AS t(critical_table)
LEFT JOIN pg_class c ON c.relname = t.critical_table
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
ORDER BY
  CASE WHEN c.relrowsecurity THEN 1 ELSE 0 END,
  t.critical_table;


-- ─── 3. Tables WITHOUT RLS (potential gaps) ─────────────────────
-- Lists all public tables that have RLS disabled.

SELECT
  c.relname AS table_without_rls,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
  obj_description(c.oid) AS table_comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY pg_total_relation_size(c.oid) DESC;


-- ─── 4. All RLS policies detail ─────────────────────────────────
-- Full listing of every policy, who it applies to, and what it allows.

SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 120) AS using_clause,
  LEFT(with_check::text, 120) AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ─── 5. Tables with RLS ON but ZERO policies ────────────────────
-- These are effectively locked out (no one can access them).

SELECT
  c.relname AS locked_table,
  '⚠️ RLS ON but NO POLICIES — effectively inaccessible' AS warning
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = c.relname AND p.schemaname = 'public'
  )
ORDER BY c.relname;


-- ─── 6. PII column inventory ────────────────────────────────────
-- Find columns that likely contain PII (email, phone, name, address).

SELECT
  table_name,
  column_name,
  data_type,
  CASE
    WHEN column_name ~* 'email' THEN 'EMAIL'
    WHEN column_name ~* 'phone' THEN 'PHONE'
    WHEN column_name ~* '(first_name|last_name|full_name|contact_name)' THEN 'NAME'
    WHEN column_name ~* 'address' THEN 'ADDRESS'
    WHEN column_name ~* '(ssn|social_security|tax_id)' THEN 'SSN/TAX'
    WHEN column_name ~* '(password|secret|token|api_key)' THEN 'CREDENTIAL'
    ELSE 'OTHER PII'
  END AS pii_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* '(email|phone|first_name|last_name|full_name|contact_name|address|ssn|social_security|tax_id|password|secret|token|api_key)'
ORDER BY
  CASE
    WHEN column_name ~* '(password|secret|token|api_key|ssn|social_security|tax_id)' THEN 0
    WHEN column_name ~* 'email' THEN 1
    WHEN column_name ~* 'phone' THEN 2
    ELSE 3
  END,
  table_name, column_name;


-- ─── 7. Summary ─────────────────────────────────────────────────

SELECT
  'Total public tables' AS metric,
  count(*)::text AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
UNION ALL
SELECT
  'Tables with RLS enabled',
  count(*)::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
UNION ALL
SELECT
  'Tables WITHOUT RLS',
  count(*)::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
SELECT
  'Total RLS policies',
  count(*)::text
FROM pg_policies
WHERE schemaname = 'public';
