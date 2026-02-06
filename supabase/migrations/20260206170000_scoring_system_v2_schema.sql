-- ============================================================================
-- Phase 1: Database Schema Changes for Definitive Scoring System v2
-- ============================================================================
-- Adds new columns for:
--   1. remarketing_scores: service_multiplier gate, geography_mode_factor,
--      bonus/penalty tracking, disqualification, needs_review, missing_fields
--   2. industry_trackers: geography_mode, service_adjacency_map
--   3. buyer_learning_history: score_at_decision
--   4. deal_scoring_adjustments: weight multipliers, parsed_instructions, counters
-- ============================================================================

-- ============================================================================
-- 1. remarketing_scores — Add scoring v2 columns
-- ============================================================================

-- Gate multipliers (applied to entire composite)
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS size_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS service_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS geography_mode_factor DECIMAL DEFAULT 1.0;

-- Bonus/penalty tracking columns
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS thesis_alignment_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_quality_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpi_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_penalty INTEGER DEFAULT 0;

-- Disqualification and review flags
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Data quality / confidence
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[],
  ADD COLUMN IF NOT EXISTS confidence_level TEXT;

-- Score tier extended (A/B/C/D/F) — existing 'tier' column supports this,
-- just ensure CHECK allows 'F' value. Drop old constraint if exists, add new one.
DO $$
BEGIN
  -- Try to drop any existing check constraint on tier
  BEGIN
    ALTER TABLE remarketing_scores DROP CONSTRAINT IF EXISTS remarketing_scores_tier_check;
  EXCEPTION WHEN undefined_object THEN
    NULL; -- constraint didn't exist, that's fine
  END;
END $$;

-- Add CHECK constraint that allows A/B/C/D/F or NULL
ALTER TABLE remarketing_scores
  ADD CONSTRAINT remarketing_scores_tier_check
  CHECK (tier IS NULL OR tier IN ('A', 'B', 'C', 'D', 'F'));

-- ============================================================================
-- 2. industry_trackers — Add geography mode + service adjacency
-- ============================================================================

ALTER TABLE industry_trackers
  ADD COLUMN IF NOT EXISTS geography_mode TEXT DEFAULT 'critical',
  ADD COLUMN IF NOT EXISTS service_adjacency_map JSONB DEFAULT NULL;

-- Add CHECK constraint for geography_mode values
DO $$
BEGIN
  BEGIN
    ALTER TABLE industry_trackers DROP CONSTRAINT IF EXISTS industry_trackers_geography_mode_check;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

ALTER TABLE industry_trackers
  ADD CONSTRAINT industry_trackers_geography_mode_check
  CHECK (geography_mode IS NULL OR geography_mode IN ('critical', 'preferred', 'minimal'));

-- ============================================================================
-- 3. buyer_learning_history — Add score_at_decision for positive learning
-- ============================================================================

ALTER TABLE buyer_learning_history
  ADD COLUMN IF NOT EXISTS score_at_decision INTEGER;

-- ============================================================================
-- 4. deal_scoring_adjustments — Add structured columns for weight mults,
--    parsed instructions, and decision counters
-- ============================================================================

ALTER TABLE deal_scoring_adjustments
  ADD COLUMN IF NOT EXISTS geography_weight_mult DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS size_weight_mult DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS services_weight_mult DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT,
  ADD COLUMN IF NOT EXISTS parsed_instructions JSONB,
  ADD COLUMN IF NOT EXISTS approved_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed_geography INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed_size INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed_services INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- 5. buyer_deal_scores (legacy) — Add matching columns for consistency
-- ============================================================================

ALTER TABLE buyer_deal_scores
  ADD COLUMN IF NOT EXISTS size_score INTEGER,
  ADD COLUMN IF NOT EXISTS owner_goals_score INTEGER,
  ADD COLUMN IF NOT EXISTS size_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS service_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS geography_mode_factor DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS thesis_alignment_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_quality_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpi_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_penalty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_tier TEXT,
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[],
  ADD COLUMN IF NOT EXISTS confidence_level TEXT;

-- ============================================================================
-- 6. Add indexes for scoring queries
-- ============================================================================

-- Fast lookup by composite score for tier filtering
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_composite
  ON remarketing_scores (composite_score DESC);

-- Fast lookup of disqualified / needs_review scores
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_disqualified
  ON remarketing_scores (listing_id, is_disqualified)
  WHERE is_disqualified = true;

CREATE INDEX IF NOT EXISTS idx_remarketing_scores_needs_review
  ON remarketing_scores (listing_id, needs_review)
  WHERE needs_review = true;

-- Learning history lookup by buyer for penalty calculation
CREATE INDEX IF NOT EXISTS idx_learning_history_buyer_action
  ON buyer_learning_history (buyer_id, action);

-- ============================================================================
-- 7. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN remarketing_scores.size_multiplier IS
  'Gate 1: Size multiplier (0.0-1.0) applied to entire composite. Wrong size = dead deal.';

COMMENT ON COLUMN remarketing_scores.service_multiplier IS
  'Gate 2: Service multiplier (0.0-1.0) applied to entire composite. Wrong services = dead deal.';

COMMENT ON COLUMN remarketing_scores.geography_mode_factor IS
  'Geography weight adjustment factor: critical=1.0, preferred=0.6, minimal=0.25';

COMMENT ON COLUMN remarketing_scores.thesis_alignment_bonus IS
  'AI-scored thesis-deal alignment bonus (0-20 pts). Only fires when buyer has thesis >50 chars.';

COMMENT ON COLUMN remarketing_scores.data_quality_bonus IS
  'Deterministic data quality reward (0-10 pts). Based on completeness of buyer profile.';

COMMENT ON COLUMN remarketing_scores.learning_penalty IS
  'Penalty from buyer_learning_history patterns (0 to -25 pts).';

COMMENT ON COLUMN remarketing_scores.is_disqualified IS
  'True when a hard disqualification rule fires (size too big/small, excluded service, geo exclusion).';

COMMENT ON COLUMN remarketing_scores.needs_review IS
  'True when score 50-65 with low confidence, or data_completeness=Low.';

COMMENT ON COLUMN remarketing_scores.missing_fields IS
  'Array of buyer data fields that are missing and would improve score accuracy.';

COMMENT ON COLUMN industry_trackers.geography_mode IS
  'How much geography matters for this industry: critical (full weight), preferred (60% weight, floor 30), minimal (25% weight, floor 50).';

COMMENT ON COLUMN industry_trackers.service_adjacency_map IS
  'Custom service adjacency overrides as JSONB. Maps services to related/adjacent services for fallback scoring.';

COMMENT ON COLUMN buyer_learning_history.score_at_decision IS
  'Composite score at the time of the approve/pass decision. Used for positive learning detection.';
