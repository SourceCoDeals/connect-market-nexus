-- ═══════════════════════════════════════════════════════════════
-- SOURCECO INDEX & PERFORMANCE AUDIT
-- ═══════════════════════════════════════════════════════════════
-- Run in the Supabase SQL Editor to analyze index coverage,
-- identify missing indexes, and find unused indexes.
--
-- Usage:
--   Paste into Supabase SQL Editor → Run
--   OR: psql "$DATABASE_URL" -f scripts/audit_indexes_performance.sql
--
-- Generated: 2026-02-27
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Index coverage on high-traffic tables ───────────────────
-- These are the most queried tables based on codebase analysis.

SELECT
  t.tablename AS table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) AS total_size,
  pg_size_pretty(pg_indexes_size(quote_ident(t.tablename)::regclass)) AS index_size,
  (SELECT count(*) FROM pg_indexes i WHERE i.tablename = t.tablename AND i.schemaname = 'public') AS index_count,
  (SELECT reltuples::bigint FROM pg_class WHERE relname = t.tablename) AS estimated_rows
FROM (VALUES
  ('profiles'),
  ('listings'),
  ('connection_requests'),
  ('connection_messages'),
  ('contacts'),
  ('remarketing_buyers'),
  ('remarketing_scores'),
  ('deals'),
  ('enrichment_queue'),
  ('enriched_contacts'),
  ('buyer_enrichment_queue'),
  ('contact_activities'),
  ('saved_listings'),
  ('user_sessions'),
  ('page_views'),
  ('admin_notifications'),
  ('chat_conversations'),
  ('chat_messages'),
  ('deal_tasks'),
  ('deal_activities'),
  ('smartlead_campaigns'),
  ('smartlead_campaign_leads'),
  ('valuation_leads'),
  ('inbound_leads'),
  ('captarget_sync_log')
) AS t(tablename)
WHERE EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = t.tablename AND n.nspname = 'public'
)
ORDER BY pg_total_relation_size(quote_ident(t.tablename)::regclass) DESC;


-- ─── 2. All existing indexes ────────────────────────────────────
-- Full listing of every index on the high-traffic tables.

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'listings', 'connection_requests', 'connection_messages',
    'contacts', 'remarketing_buyers', 'remarketing_scores', 'deals',
    'enrichment_queue', 'enriched_contacts', 'buyer_enrichment_queue',
    'contact_activities', 'saved_listings', 'user_sessions', 'page_views',
    'admin_notifications', 'chat_conversations', 'chat_messages',
    'deal_tasks', 'deal_activities', 'smartlead_campaigns',
    'smartlead_campaign_leads', 'valuation_leads', 'inbound_leads',
    'captarget_sync_log'
  )
ORDER BY tablename, indexname;


-- ─── 3. Index usage stats ───────────────────────────────────────
-- Shows how often each index is actually scanned.
-- Low idx_scan means the index may be unused.

SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  idx_tup_read AS rows_read,
  idx_tup_fetch AS rows_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;


-- ─── 4. Unused indexes (candidates for removal) ────────────────
-- Indexes that have never been scanned since last stats reset.
-- Excludes primary keys and unique constraints.

SELECT
  s.relname AS table_name,
  s.indexrelname AS unused_index,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS wasted_space,
  s.idx_scan AS scan_count
FROM pg_stat_user_indexes s
JOIN pg_index i ON s.indexrelid = i.indexrelid
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
  AND NOT i.indisunique
  AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC;


-- ─── 5. Missing index candidates ────────────────────────────────
-- Tables with high sequential scan ratios may need better indexes.

SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE
    WHEN (seq_scan + idx_scan) > 0
    THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 1)
    ELSE 0
  END AS index_usage_pct,
  n_live_tup AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(quote_ident(relname)::regclass)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND (seq_scan + idx_scan) > 0
  AND n_live_tup > 1000
ORDER BY
  CASE
    WHEN (seq_scan + idx_scan) > 0
    THEN 100.0 * idx_scan / (seq_scan + idx_scan)
    ELSE 100
  END ASC
LIMIT 30;


-- ─── 6. Duplicate indexes ──────────────────────────────────────
-- Indexes that cover the same columns (exact duplicates).

SELECT
  a.indrelid::regclass AS table_name,
  a.indexrelid::regclass AS index_a,
  b.indexrelid::regclass AS index_b,
  pg_size_pretty(pg_relation_size(a.indexrelid)) AS size_a,
  pg_size_pretty(pg_relation_size(b.indexrelid)) AS size_b
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid
  AND a.indexrelid < b.indexrelid
  AND a.indkey = b.indkey
  AND a.indclass = b.indclass
WHERE a.indrelid::regclass::text NOT LIKE 'pg_%';


-- ─── 7. Foreign keys without indexes ────────────────────────────
-- FK columns that lack an index can cause slow DELETE/UPDATE.

SELECT
  tc.table_name,
  kcu.column_name AS fk_column,
  ccu.table_name AS references_table,
  '⚠️ No index on FK column' AS warning
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes pi
    WHERE pi.tablename = tc.table_name
      AND pi.schemaname = 'public'
      AND pi.indexdef LIKE '%' || kcu.column_name || '%'
  )
ORDER BY tc.table_name, kcu.column_name;


-- ─── 8. Recommended indexes for common query patterns ───────────
-- Based on codebase analysis of .eq(), .order(), .filter() calls.
-- Uncomment and run CREATE INDEX statements as needed.

/*
-- profiles: frequently queried by approval_status + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_approval_created
  ON profiles (approval_status, created_at DESC);

-- contacts: queried by type + workspace
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_type_workspace
  ON contacts (contact_type, workspace_id);

-- contacts: queried by listing_id for seller lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_listing_id
  ON contacts (listing_id) WHERE listing_id IS NOT NULL;

-- contacts: queried by remarketing_buyer_id for buyer lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_buyer_id
  ON contacts (remarketing_buyer_id) WHERE remarketing_buyer_id IS NOT NULL;

-- enrichment_queue: hot path for status-based processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrichment_queue_status_queued
  ON enrichment_queue (status, queued_at) WHERE status IN ('pending', 'processing');

-- contact_activities: PhoneBurner call history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_activities_buyer_type
  ON contact_activities (remarketing_buyer_id, activity_type, call_started_at DESC)
  WHERE remarketing_buyer_id IS NOT NULL;

-- deal_tasks: filtered by assignee and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deal_tasks_assignee_status
  ON deal_tasks (assigned_to, status, due_date)
  WHERE status != 'completed';
*/


-- ─── 9. Summary ─────────────────────────────────────────────────

SELECT 'Total indexes in public schema' AS metric,
  count(*)::text AS value
FROM pg_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'Unused indexes (0 scans)',
  count(*)::text
FROM pg_stat_user_indexes s
JOIN pg_index i ON s.indexrelid = i.indexrelid
WHERE s.schemaname = 'public' AND s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
UNION ALL
SELECT 'Total index storage',
  pg_size_pretty(sum(pg_relation_size(indexrelid)))
FROM pg_stat_user_indexes WHERE schemaname = 'public'
UNION ALL
SELECT 'Total table storage',
  pg_size_pretty(sum(pg_total_relation_size(quote_ident(relname)::regclass)))
FROM pg_stat_user_tables WHERE schemaname = 'public';
