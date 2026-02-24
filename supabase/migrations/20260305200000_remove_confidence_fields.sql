-- Remove all confidence, data_completeness, and missing_fields columns
-- These fields are unused proxies for confidence scoring and should be fully removed.

-- Migration 1: listings table
ALTER TABLE listings
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS ebitda_confidence,
  DROP COLUMN IF EXISTS revenue_confidence,
  DROP COLUMN IF EXISTS seller_interest_confidence,
  DROP COLUMN IF EXISTS data_completeness;

-- Migration 2: buyer_deal_scores table
ALTER TABLE buyer_deal_scores
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS data_completeness,
  DROP COLUMN IF EXISTS missing_fields;

-- Migration 3: remarketing_buyers table
ALTER TABLE remarketing_buyers
  DROP COLUMN IF EXISTS thesis_confidence,
  DROP COLUMN IF EXISTS enrichment_confidence,
  DROP COLUMN IF EXISTS alignment_confidence,
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS data_completeness;

-- Migration 4: buyers table (if separate from remarketing_buyers)
ALTER TABLE buyers
  DROP COLUMN IF EXISTS thesis_confidence,
  DROP COLUMN IF EXISTS enrichment_confidence,
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS data_completeness;

-- Migration 5: remarketing_scores table
ALTER TABLE remarketing_scores
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS data_completeness,
  DROP COLUMN IF EXISTS missing_fields;

-- Migration 7: score_snapshots table
ALTER TABLE score_snapshots
  DROP COLUMN IF EXISTS confidence_level,
  DROP COLUMN IF EXISTS scoring_confidence,
  DROP COLUMN IF EXISTS data_completeness,
  DROP COLUMN IF EXISTS missing_fields;

-- Enum cleanup
DROP TYPE IF EXISTS confidence_level_enum;
DROP TYPE IF EXISTS scoring_confidence_enum;
