-- Add compression for large text/JSONB columns to reduce storage costs
-- PostgreSQL 14+ supports transparent compression with TOAST

-- ============= STORAGE OPTIMIZATION =============

/**
 * Set TOAST compression strategy for large columns
 * 'pglz' = PostgreSQL's built-in compression (good balance)
 * 'lz4' = Faster compression/decompression (if available)
 * 'external' = Store externally without compression
 */

-- ============= M&A GUIDE GENERATIONS TABLE =============

-- Compress guide content JSONB (typically 10-50KB of structured data)
ALTER TABLE ma_guide_generations
  ALTER COLUMN generated_content SET STORAGE EXTENDED;

COMMENT ON COLUMN ma_guide_generations.generated_content IS
  'M&A guide generated content (JSONB). TOAST storage=EXTENDED enables automatic compression for values >2KB.';

-- ============= BUYER CRITERIA EXTRACTIONS TABLE =============

-- Compress extracted criteria JSONB
ALTER TABLE buyer_criteria_extractions
  ALTER COLUMN extracted_criteria SET STORAGE EXTENDED;

COMMENT ON COLUMN buyer_criteria_extractions.extracted_criteria IS
  'Extracted buyer criteria JSON. TOAST storage=EXTENDED enables compression.';

-- ============= CRITERIA EXTRACTION SOURCES TABLE =============

-- Compress extracted data
ALTER TABLE criteria_extraction_sources
  ALTER COLUMN extracted_data SET STORAGE EXTENDED;

ALTER TABLE criteria_extraction_sources
  ALTER COLUMN source_metadata SET STORAGE EXTENDED;

-- ============= AI RESPONSE CACHE TABLE =============

-- Compress cached responses
ALTER TABLE ai_response_cache
  ALTER COLUMN response_content SET STORAGE EXTENDED;

ALTER TABLE ai_response_cache
  ALTER COLUMN response_tool_call SET STORAGE EXTENDED;

-- ============= COMPRESSION STATISTICS VIEW =============

/**
 * View to monitor compression effectiveness
 * Shows actual storage size vs uncompressed size for large columns
 */
CREATE OR REPLACE VIEW storage_compression_stats AS
SELECT
  nspname as schema_name,
  relname as table_name,
  attname as column_name,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  CASE attstorage
    WHEN 'p' THEN 'PLAIN (no compression)'
    WHEN 'e' THEN 'EXTERNAL (no compression)'
    WHEN 'x' THEN 'EXTENDED (compressed)'
    WHEN 'm' THEN 'MAIN (compressed inline)'
  END as storage_strategy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE
  nspname NOT IN ('pg_catalog', 'information_schema')
  AND relkind = 'r'
  AND atttypid IN (
    'text'::regtype,
    'json'::regtype,
    'jsonb'::regtype
  )
  AND NOT attisdropped
  AND attnum > 0
ORDER BY relname, attnum;

COMMENT ON VIEW storage_compression_stats IS
  'Monitor compression effectiveness for large columns. Shows storage strategy and sizes.';

-- ============= VACUUM AND ANALYZE =============

/**
 * Function to optimize table storage after compression changes
 * Reclaims space and updates statistics
 */
CREATE OR REPLACE FUNCTION optimize_table_storage(table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('VACUUM FULL ANALYZE %I', table_name);
  RAISE NOTICE 'Optimized storage for table: %', table_name;
END;
$$;

COMMENT ON FUNCTION optimize_table_storage IS
  'Optimize table storage after compression changes. Reclaims space and updates statistics.';

-- Run VACUUM ANALYZE on large tables to apply compression
VACUUM ANALYZE ma_guide_generations;
VACUUM ANALYZE buyer_criteria_extractions;
VACUUM ANALYZE criteria_extraction_sources;
VACUUM ANALYZE ai_response_cache;

-- ============= STORAGE MONITORING =============

/**
 * View for monitoring table sizes and identifying candidates for compression
 */
CREATE OR REPLACE VIEW table_storage_stats AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as external_size,
  ROUND(100.0 * (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename))
    / NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0), 2) as external_percent,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

COMMENT ON VIEW table_storage_stats IS
  'Monitor table storage usage. External_percent shows how much data is in TOAST tables (often compressed).';

-- ============= ARCHIVAL STRATEGY =============

/**
 * Archival tables for old data (with compression)
 * Move old completed records here to keep main tables lean
 */

-- Archive old M&A guide generations (>90 days)
CREATE TABLE IF NOT EXISTS ma_guide_generations_archive (
  LIKE ma_guide_generations INCLUDING ALL
);

ALTER TABLE ma_guide_generations_archive
  ALTER COLUMN generated_content SET STORAGE EXTENDED;

COMMENT ON TABLE ma_guide_generations_archive IS
  'Archive of old M&A guide generations (>90 days). Compressed for storage efficiency.';

-- Archive old buyer criteria extractions (>90 days)
CREATE TABLE IF NOT EXISTS buyer_criteria_extractions_archive (
  LIKE buyer_criteria_extractions INCLUDING ALL
);

ALTER TABLE buyer_criteria_extractions_archive
  ALTER COLUMN extracted_criteria SET STORAGE EXTENDED;

COMMENT ON TABLE buyer_criteria_extractions_archive IS
  'Archive of old buyer criteria extractions (>90 days). Compressed for storage efficiency.';

/**
 * Function to archive old records
 * Moves records >90 days old to archive tables
 */
CREATE OR REPLACE FUNCTION archive_old_records()
RETURNS TABLE(
  table_name text,
  archived_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  guide_count bigint;
  criteria_count bigint;
BEGIN
  -- Archive old guide generations
  WITH moved AS (
    DELETE FROM ma_guide_generations
    WHERE completed_at < now() - interval '90 days'
      AND status IN ('completed', 'failed')
    RETURNING *
  )
  INSERT INTO ma_guide_generations_archive
  SELECT * FROM moved;

  GET DIAGNOSTICS guide_count = ROW_COUNT;

  -- Archive old criteria extractions
  WITH moved AS (
    DELETE FROM buyer_criteria_extractions
    WHERE completed_at < now() - interval '90 days'
      AND status IN ('completed', 'failed', 'needs_review')
    RETURNING *
  )
  INSERT INTO buyer_criteria_extractions_archive
  SELECT * FROM moved;

  GET DIAGNOSTICS criteria_count = ROW_COUNT;

  -- Return results
  RETURN QUERY
  SELECT 'ma_guide_generations'::text, guide_count
  UNION ALL
  SELECT 'buyer_criteria_extractions'::text, criteria_count;

  RAISE NOTICE 'Archived % guide generations and % criteria extractions',
    guide_count, criteria_count;
END;
$$;

COMMENT ON FUNCTION archive_old_records IS
  'Archive records >90 days old to compressed archive tables. Run monthly to keep main tables lean.';

-- Schedule monthly archival
SELECT cron.schedule(
  'archive-old-records',
  '0 2 1 * *', -- 2 AM on the 1st of each month
  $$SELECT archive_old_records();$$
);
