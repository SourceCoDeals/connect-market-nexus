-- Migration: Create Unified Transcripts Table
-- Purpose: Consolidate call_transcripts, buyer_transcripts, and deal_transcripts into single table
-- Author: Phase 2 Architectural Consolidation
-- Date: 2026-02-05

-- ============================================================================
-- STEP 1: Create unified transcripts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity relationships (polymorphic design)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('buyer', 'deal', 'call', 'both')),
  buyer_id UUID REFERENCES remarketing_buyers(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  universe_id UUID REFERENCES universes(id) ON DELETE SET NULL,

  -- Content
  transcript_text TEXT NOT NULL,
  source TEXT DEFAULT 'call', -- 'call', 'meeting', 'email', 'file_upload', 'manual', 'fireflies'
  call_type TEXT CHECK (call_type IN ('seller_call', 'buyer_call', 'seller_buyer_intro', 'management_presentation', 'q_and_a', 'site_visit_debrief', 'other')),
  call_date TIMESTAMPTZ,

  -- File references
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  transcript_url TEXT, -- External link (Fireflies.ai, etc.)
  recording_url TEXT,

  -- Extraction results (universal JSONB format)
  extracted_insights JSONB DEFAULT '{}'::jsonb,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'insufficient_data')),
  extraction_error TEXT, -- Error message if failed
  processed_at TIMESTAMPTZ,

  -- Metadata
  title TEXT,
  participants TEXT[],
  key_quotes TEXT[],
  ceo_detected BOOLEAN DEFAULT FALSE,

  -- Legacy support (for backwards compatibility during transition)
  applied_to_deal BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transcripts_entity_type
  ON transcripts(entity_type);

CREATE INDEX IF NOT EXISTS idx_transcripts_buyer_id
  ON transcripts(buyer_id)
  WHERE buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcripts_listing_id
  ON transcripts(listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcripts_universe_id
  ON transcripts(universe_id)
  WHERE universe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcripts_extraction_status
  ON transcripts(extraction_status);

CREATE INDEX IF NOT EXISTS idx_transcripts_created_at
  ON transcripts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcripts_pending
  ON transcripts(extraction_status, created_at)
  WHERE extraction_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transcripts_ceo_detected
  ON transcripts(ceo_detected)
  WHERE ceo_detected = TRUE;

-- Composite index for common query pattern: "get all transcripts for a buyer"
CREATE INDEX IF NOT EXISTS idx_transcripts_buyer_created
  ON transcripts(buyer_id, created_at DESC)
  WHERE buyer_id IS NOT NULL;

-- Composite index for common query pattern: "get all transcripts for a deal"
CREATE INDEX IF NOT EXISTS idx_transcripts_listing_created
  ON transcripts(listing_id, created_at DESC)
  WHERE listing_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE transcripts IS 'Unified table for all transcript types (buyer, deal, call). Consolidates call_transcripts, buyer_transcripts, and deal_transcripts.';
COMMENT ON COLUMN transcripts.entity_type IS 'Type of transcript: buyer (buyer-only), deal (listing-only), call (linked to both), or both (processed for both entities)';
COMMENT ON COLUMN transcripts.buyer_id IS 'Reference to remarketing_buyers table. NULL for deal-only transcripts.';
COMMENT ON COLUMN transcripts.listing_id IS 'Reference to listings table. NULL for buyer-only transcripts.';
COMMENT ON COLUMN transcripts.universe_id IS 'Optional reference to universe for buyer transcripts';
COMMENT ON COLUMN transcripts.extracted_insights IS 'Universal JSONB format for extracted data. Structure varies by entity_type: {buyer: {...}, deal: {...}}';
COMMENT ON COLUMN transcripts.extraction_status IS 'Processing status: pending (not yet processed), processing (currently extracting), completed (success), failed (error), insufficient_data (not enough info)';
COMMENT ON COLUMN transcripts.ceo_detected IS 'Auto-detected CEO/owner involvement in transcript (triggers +40 engagement signal)';
COMMENT ON COLUMN transcripts.participants IS 'Array of participant names mentioned in transcript';
COMMENT ON COLUMN transcripts.key_quotes IS 'Important verbatim quotes extracted from transcript';

-- ============================================================================
-- STEP 4: Enable RLS (Row Level Security)
-- ============================================================================

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view all transcripts
CREATE POLICY "Admin users can view all transcripts"
  ON transcripts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admin users can insert transcripts
CREATE POLICY "Admin users can insert transcripts"
  ON transcripts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admin users can update transcripts
CREATE POLICY "Admin users can update transcripts"
  ON transcripts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admin users can delete transcripts
CREATE POLICY "Admin users can delete transcripts"
  ON transcripts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
  ON transcripts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 5: Create trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transcripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_transcripts_updated_at();

-- ============================================================================
-- STEP 6: Create helper views for backwards compatibility
-- ============================================================================

-- View: Buyer transcripts only
CREATE OR REPLACE VIEW v_buyer_transcripts AS
SELECT
  id,
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
FROM transcripts
WHERE entity_type IN ('buyer', 'both');

-- View: Deal transcripts only
CREATE OR REPLACE VIEW v_deal_transcripts AS
SELECT
  id,
  listing_id,
  transcript_text,
  source,
  call_date,
  file_url,
  transcript_url,
  extracted_insights AS extracted_data,
  extraction_status,
  processed_at,
  applied_to_deal,
  applied_at,
  title,
  created_at,
  created_by,
  updated_at
FROM transcripts
WHERE entity_type IN ('deal', 'both');

-- View: Call transcripts only
CREATE OR REPLACE VIEW v_call_transcripts AS
SELECT
  id,
  buyer_id,
  listing_id,
  transcript_text,
  call_type,
  call_date,
  file_url,
  file_type,
  extracted_insights,
  extraction_status AS processing_status,
  processed_at,
  key_quotes,
  ceo_detected,
  created_at
FROM transcripts
WHERE entity_type IN ('call', 'both');

COMMENT ON VIEW v_buyer_transcripts IS 'Backwards-compatible view for buyer_transcripts queries';
COMMENT ON VIEW v_deal_transcripts IS 'Backwards-compatible view for deal_transcripts queries';
COMMENT ON VIEW v_call_transcripts IS 'Backwards-compatible view for call_transcripts queries';

-- ============================================================================
-- FINAL REPORT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE E'\n========================================';
  RAISE NOTICE 'UNIFIED TRANSCRIPTS TABLE CREATED';
  RAISE NOTICE E'========================================\n';
  RAISE NOTICE 'Table: transcripts (with RLS enabled)';
  RAISE NOTICE 'Indexes: 10 indexes created for performance';
  RAISE NOTICE 'Views: 3 backwards-compatible views created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Run 20260205130001_migrate_transcript_data.sql';
END $$;
