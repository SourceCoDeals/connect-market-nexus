-- Backfill Script: Fix existing transcript records affected by bugs
-- Purpose: Repair data damaged by BUG #1 (missing processed_at) and BUG #2 (overwritten extraction_sources)
-- Author: CTO Audit Backfill
-- Date: 2026-02-05
-- IMPORTANT: Run this AFTER deploying the fixed edge functions

-- ============================================================================
-- STEP 1: Backfill buyer_transcripts.processed_at for extracted transcripts
-- ============================================================================
-- BUG #1: buyer_transcripts were extracted but processed_at was never set
-- Fix: If a buyer's data_last_updated is AFTER the transcript created_at,
--      and the buyer has extraction_sources, mark transcript as processed

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Update buyer_transcripts that were actually processed but not marked
  UPDATE buyer_transcripts bt
  SET
    processed_at = rb.data_last_updated,
    extraction_status = 'completed'
  FROM remarketing_buyers rb
  WHERE
    bt.buyer_id = rb.id
    AND bt.processed_at IS NULL
    AND rb.data_last_updated > bt.created_at
    AND rb.extraction_sources IS NOT NULL
    AND jsonb_array_length(rb.extraction_sources) > 0;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'BACKFILL STEP 1: Updated % buyer_transcripts records with missing processed_at', affected_count;
END $$;


-- ============================================================================
-- STEP 2: Identify buyers with multiple transcripts but only 1 extraction source
-- ============================================================================
-- BUG #2: extraction_sources array was overwritten instead of appended
-- This query identifies affected buyers for manual review

DO $$
DECLARE
  affected_buyers TEXT;
BEGIN
  SELECT string_agg(buyer_info, E'\n')
  INTO affected_buyers
  FROM (
    SELECT
      rb.id::text || ' - ' || rb.company_name || ' (' || COUNT(bt.id) || ' transcripts, ' ||
      COALESCE(jsonb_array_length(rb.extraction_sources), 0) || ' sources)' as buyer_info
    FROM remarketing_buyers rb
    JOIN buyer_transcripts bt ON bt.buyer_id = rb.id
    WHERE bt.processed_at IS NOT NULL
    GROUP BY rb.id, rb.company_name, rb.extraction_sources
    HAVING COUNT(bt.id) > COALESCE(jsonb_array_length(rb.extraction_sources), 0)
    ORDER BY COUNT(bt.id) DESC
    LIMIT 50
  ) affected;

  IF affected_buyers IS NOT NULL THEN
    RAISE NOTICE E'BACKFILL STEP 2: Found buyers with missing extraction sources:\n%', affected_buyers;
    RAISE NOTICE 'ACTION REQUIRED: Use "Re-extract All" button in UI for these buyers to rebuild extraction_sources array';
  ELSE
    RAISE NOTICE 'BACKFILL STEP 2: No buyers found with extraction_sources array issues';
  END IF;
END $$;


-- ============================================================================
-- STEP 3: Create helper view for monitoring extraction health
-- ============================================================================
CREATE OR REPLACE VIEW transcript_extraction_health AS
SELECT
  'buyer_transcripts' as table_name,
  COUNT(*) as total_transcripts,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_count,
  COUNT(*) FILTER (WHERE extraction_status = 'failed') as failed_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processed_at IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as processed_percentage
FROM buyer_transcripts
UNION ALL
SELECT
  'deal_transcripts' as table_name,
  COUNT(*) as total_transcripts,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_count,
  0 as failed_count, -- deal_transcripts doesn't have extraction_status
  ROUND(100.0 * COUNT(*) FILTER (WHERE processed_at IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as processed_percentage
FROM deal_transcripts
UNION ALL
SELECT
  'call_transcripts' as table_name,
  COUNT(*) as total_transcripts,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending_count,
  COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processed_at IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as processed_percentage
FROM call_transcripts;

COMMENT ON VIEW transcript_extraction_health IS 'Real-time health metrics for transcript extraction pipeline';


-- ============================================================================
-- STEP 4: Create helper view for extraction source audit
-- ============================================================================
CREATE OR REPLACE VIEW extraction_source_audit AS
SELECT
  rb.id as buyer_id,
  rb.company_name,
  COUNT(bt.id) as transcript_count,
  COALESCE(jsonb_array_length(rb.extraction_sources), 0) as source_count,
  COUNT(bt.id) - COALESCE(jsonb_array_length(rb.extraction_sources), 0) as missing_sources,
  rb.data_last_updated,
  CASE
    WHEN COUNT(bt.id) > COALESCE(jsonb_array_length(rb.extraction_sources), 0) THEN '⚠️ MISSING SOURCES'
    WHEN COUNT(bt.id) = COALESCE(jsonb_array_length(rb.extraction_sources), 0) THEN '✅ OK'
    WHEN COUNT(bt.id) < COALESCE(jsonb_array_length(rb.extraction_sources), 0) THEN '⚠️ EXTRA SOURCES'
    ELSE '⚠️ UNKNOWN'
  END as status
FROM remarketing_buyers rb
LEFT JOIN buyer_transcripts bt ON bt.buyer_id = rb.id AND bt.processed_at IS NOT NULL
GROUP BY rb.id, rb.company_name, rb.extraction_sources, rb.data_last_updated
HAVING COUNT(bt.id) > 0 OR COALESCE(jsonb_array_length(rb.extraction_sources), 0) > 0
ORDER BY missing_sources DESC, transcript_count DESC;

COMMENT ON VIEW extraction_source_audit IS 'Audit view showing buyers with extraction_sources mismatches (affected by BUG #2)';


-- ============================================================================
-- FINAL REPORT: Show backfill results
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'BACKFILL COMPLETE';
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - transcript_extraction_health: Monitor extraction pipeline health';
  RAISE NOTICE '  - extraction_source_audit: Identify buyers needing re-extraction';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Query transcript_extraction_health to see current status';
  RAISE NOTICE '  2. Query extraction_source_audit to find buyers with missing sources';
  RAISE NOTICE '  3. Use "Re-extract All" button in UI for affected buyers';
  RAISE NOTICE '  4. Set up monitoring alerts using transcript_extraction_errors table';
END $$;
