-- Migration: Migrate Data from 3 Tables to Unified Transcripts
-- Purpose: Copy data from call_transcripts, buyer_transcripts, deal_transcripts → transcripts
-- Author: Phase 2 Architectural Consolidation
-- Date: 2026-02-05
-- IMPORTANT: Run this AFTER 20260205130000_create_unified_transcripts_table.sql

-- ============================================================================
-- STEP 1: Migrate data from call_transcripts
-- ============================================================================

DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  RAISE NOTICE 'Migrating data from call_transcripts...';

  INSERT INTO transcripts (
    id,
    entity_type,
    buyer_id,
    listing_id,
    transcript_text,
    source,
    call_type,
    call_date,
    file_url,
    file_type,
    extracted_insights,
    extraction_status,
    processed_at,
    key_quotes,
    ceo_detected,
    created_at,
    updated_at
  )
  SELECT
    id,
    CASE
      WHEN buyer_id IS NOT NULL AND listing_id IS NOT NULL THEN 'both'
      WHEN buyer_id IS NOT NULL THEN 'buyer'
      WHEN listing_id IS NOT NULL THEN 'deal'
      ELSE 'call'
    END as entity_type,
    buyer_id,
    listing_id,
    transcript_text,
    'call' as source,
    call_type,
    call_date,
    file_url,
    file_type,
    extracted_insights,
    CASE processing_status
      WHEN 'pending' THEN 'pending'
      WHEN 'processing' THEN 'processing'
      WHEN 'completed' THEN 'completed'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending'
    END as extraction_status,
    processed_at,
    key_quotes,
    ceo_detected,
    created_at,
    updated_at
  FROM call_transcripts
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % records from call_transcripts', migrated_count;
END $$;

-- ============================================================================
-- STEP 2: Migrate data from buyer_transcripts
-- ============================================================================

DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  RAISE NOTICE 'Migrating data from buyer_transcripts...';

  INSERT INTO transcripts (
    id,
    entity_type,
    buyer_id,
    universe_id,
    transcript_text,
    source,
    call_date,
    file_name,
    file_url,
    transcript_url,
    recording_url,
    extracted_insights,
    extraction_status,
    processed_at,
    title,
    participants,
    created_at,
    created_by,
    updated_at
  )
  SELECT
    id,
    'buyer' as entity_type,
    buyer_id,
    universe_id,
    transcript_text,
    COALESCE(source, 'call') as source,
    call_date,
    file_name,
    file_url,
    transcript_link as transcript_url,
    recording_url,
    extracted_insights,
    COALESCE(extraction_status, 'pending') as extraction_status,
    processed_at,
    title,
    participants,
    created_at,
    created_by,
    updated_at
  FROM buyer_transcripts
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % records from buyer_transcripts', migrated_count;
END $$;

-- ============================================================================
-- STEP 3: Migrate data from deal_transcripts
-- ============================================================================

DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  RAISE NOTICE 'Migrating data from deal_transcripts...';

  INSERT INTO transcripts (
    id,
    entity_type,
    listing_id,
    transcript_text,
    source,
    call_date,
    file_url,
    transcript_url,
    extracted_insights,
    extraction_status,
    processed_at,
    applied_to_deal,
    applied_at,
    title,
    created_at,
    created_by,
    updated_at
  )
  SELECT
    id,
    'deal' as entity_type,
    listing_id,
    transcript_text,
    COALESCE(source, 'call') as source,
    call_date,
    file_url,
    transcript_url,
    extracted_data as extracted_insights,
    CASE
      WHEN processed_at IS NOT NULL THEN 'completed'
      ELSE 'pending'
    END as extraction_status,
    processed_at,
    applied_to_deal,
    applied_at,
    title,
    created_at,
    created_by,
    updated_at
  FROM deal_transcripts
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % records from deal_transcripts', migrated_count;
END $$;

-- ============================================================================
-- STEP 4: Verify data integrity
-- ============================================================================

DO $$
DECLARE
  call_count INTEGER;
  buyer_count INTEGER;
  deal_count INTEGER;
  total_count INTEGER;
  transcripts_count INTEGER;
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'DATA MIGRATION VERIFICATION';
  RAISE NOTICE E'========================================\n';

  -- Count original records
  SELECT COUNT(*) INTO call_count FROM call_transcripts;
  SELECT COUNT(*) INTO buyer_count FROM buyer_transcripts;
  SELECT COUNT(*) INTO deal_count FROM deal_transcripts;
  total_count := call_count + buyer_count + deal_count;

  -- Count migrated records
  SELECT COUNT(*) INTO transcripts_count FROM transcripts;

  RAISE NOTICE 'Source tables:';
  RAISE NOTICE '  call_transcripts: % records', call_count;
  RAISE NOTICE '  buyer_transcripts: % records', buyer_count;
  RAISE NOTICE '  deal_transcripts: % records', deal_count;
  RAISE NOTICE '  TOTAL: % records', total_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Destination table:';
  RAISE NOTICE '  transcripts: % records', transcripts_count;
  RAISE NOTICE '';

  IF transcripts_count = total_count THEN
    RAISE NOTICE '✅ SUCCESS: All records migrated successfully!';
  ELSIF transcripts_count > total_count THEN
    RAISE WARNING '⚠️  WARNING: More records in transcripts (%) than source tables (%). Possible duplicates?', transcripts_count, total_count;
  ELSE
    RAISE WARNING '⚠️  WARNING: Missing records! Expected %, got %', total_count, transcripts_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Archive old tables (rename, don't drop)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'ARCHIVING OLD TABLES';
  RAISE NOTICE E'========================================\n';

  -- Rename old tables with _archived suffix and timestamp
  ALTER TABLE IF EXISTS call_transcripts RENAME TO call_transcripts_archived_20260205;
  ALTER TABLE IF EXISTS buyer_transcripts RENAME TO buyer_transcripts_archived_20260205;
  ALTER TABLE IF EXISTS deal_transcripts RENAME TO deal_transcripts_archived_20260205;

  RAISE NOTICE 'Old tables archived:';
  RAISE NOTICE '  call_transcripts → call_transcripts_archived_20260205';
  RAISE NOTICE '  buyer_transcripts → buyer_transcripts_archived_20260205';
  RAISE NOTICE '  deal_transcripts → deal_transcripts_archived_20260205';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Archived tables will be kept for 30 days for rollback safety.';
  RAISE NOTICE 'After validation, run: DROP TABLE IF EXISTS *_archived_20260205;';
END $$;

-- ============================================================================
-- STEP 6: Create materialized view for analytics
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS transcript_analytics AS
SELECT
  entity_type,
  DATE_TRUNC('day', created_at) as date,
  extraction_status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE ceo_detected = TRUE) as ceo_detected_count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM transcripts
GROUP BY entity_type, DATE_TRUNC('day', created_at), extraction_status
ORDER BY date DESC, entity_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_analytics_unique
  ON transcript_analytics(entity_type, date, extraction_status);

COMMENT ON MATERIALIZED VIEW transcript_analytics IS 'Daily analytics for transcript processing. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_analytics;';

-- ============================================================================
-- FINAL REPORT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify data: SELECT entity_type, COUNT(*) FROM transcripts GROUP BY entity_type;';
  RAISE NOTICE '  2. Update application code to use transcripts table';
  RAISE NOTICE '  3. Test thoroughly for 30 days';
  RAISE NOTICE '  4. Drop archived tables: DROP TABLE *_archived_20260205;';
  RAISE NOTICE '';
  RAISE NOTICE 'Analytics view created: transcript_analytics';
  RAISE NOTICE 'Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_analytics;';
END $$;
