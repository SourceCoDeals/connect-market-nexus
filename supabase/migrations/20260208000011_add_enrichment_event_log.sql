-- Create enrichment event log table for audit trail
-- Tracks all buyer enrichment operations, what was updated, what was blocked, and why

CREATE TABLE IF NOT EXISTS enrichment_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES remarketing_buyers(id) ON DELETE CASCADE,

  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN ('enrichment', 'transcript', 'notes', 'csv_import', 'manual_edit', 'dedup')),
  source_type TEXT NOT NULL, -- 'platform_website', 'pe_firm_website', 'transcript', 'notes', 'csv', 'manual'
  triggered_by TEXT, -- User ID or 'system'

  -- What was attempted
  fields_attempted TEXT[] NOT NULL DEFAULT '{}', -- All fields in the update request
  fields_updated TEXT[] NOT NULL DEFAULT '{}', -- Fields that were actually written
  fields_blocked TEXT[] NOT NULL DEFAULT '{}', -- Fields blocked by provenance rules
  fields_skipped TEXT[] NOT NULL DEFAULT '{}', -- Fields skipped by transcript protection

  -- Why fields were blocked
  block_reasons JSONB DEFAULT '{}', -- { "field_name": "reason" }

  -- Data quality
  confidence_score NUMERIC(5,2), -- For enrichment operations
  data_completeness_before INTEGER, -- Buyer completeness before update
  data_completeness_after INTEGER, -- Buyer completeness after update

  -- Concurrency handling
  lock_acquired BOOLEAN DEFAULT false,
  lock_conflict BOOLEAN DEFAULT false,
  version_before INTEGER, -- Optimistic locking version before
  version_after INTEGER, -- Version after

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_success', 'blocked', 'failed', 'lock_conflict')),
  error_message TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}', -- Extra context (transcript_id, source URLs, etc.)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_enrichment_event_buyer ON enrichment_event_log(buyer_id);
CREATE INDEX idx_enrichment_event_type ON enrichment_event_log(event_type);
CREATE INDEX idx_enrichment_event_status ON enrichment_event_log(status);
CREATE INDEX idx_enrichment_event_created ON enrichment_event_log(created_at DESC);
CREATE INDEX idx_enrichment_event_source ON enrichment_event_log(source_type);

-- Composite index for common query patterns
CREATE INDEX idx_enrichment_event_buyer_created ON enrichment_event_log(buyer_id, created_at DESC);

COMMENT ON TABLE enrichment_event_log IS 'Audit log for all buyer enrichment operations. Tracks what was updated, what was blocked by provenance rules, and why.';
COMMENT ON COLUMN enrichment_event_log.fields_blocked IS 'Fields that were blocked by field-level provenance rules (PE→Platform separation)';
COMMENT ON COLUMN enrichment_event_log.fields_skipped IS 'Fields that were skipped because they are protected by transcript source';
COMMENT ON COLUMN enrichment_event_log.lock_conflict IS 'True if operation failed due to concurrent enrichment lock';
COMMENT ON COLUMN enrichment_event_log.status IS 'success = all fields updated, partial_success = some blocked/skipped, blocked = all blocked, failed = error, lock_conflict = concurrent operation';

-- Example queries:

-- Find all provenance violations (where fields were blocked)
-- SELECT buyer_id, event_type, source_type, fields_blocked, block_reasons, created_at
-- FROM enrichment_event_log
-- WHERE array_length(fields_blocked, 1) > 0
-- ORDER BY created_at DESC;

-- Find buyers with frequent lock conflicts
-- SELECT buyer_id, COUNT(*) as conflict_count
-- FROM enrichment_event_log
-- WHERE lock_conflict = true
-- GROUP BY buyer_id
-- HAVING COUNT(*) > 3
-- ORDER BY conflict_count DESC;

-- Track enrichment success rate
-- SELECT
--   event_type,
--   COUNT(*) as total,
--   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
--   SUM(CASE WHEN status = 'partial_success' THEN 1 ELSE 0 END) as partial,
--   SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
--   SUM(CASE WHEN status = 'lock_conflict' THEN 1 ELSE 0 END) as conflicts
-- FROM enrichment_event_log
-- WHERE created_at > now() - interval '7 days'
-- GROUP BY event_type;

-- Find transcript-protected fields being overwritten
-- SELECT buyer_id, source_type, fields_skipped, created_at
-- FROM enrichment_event_log
-- WHERE array_length(fields_skipped, 1) > 0
--   AND source_type NOT IN ('transcript', 'buyer_transcript')
-- ORDER BY created_at DESC;
