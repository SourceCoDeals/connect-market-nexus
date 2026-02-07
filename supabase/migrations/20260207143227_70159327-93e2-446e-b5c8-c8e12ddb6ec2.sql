-- remarketing_scores: gate multipliers
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS size_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS service_multiplier DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS geography_mode_factor DECIMAL DEFAULT 1.0;

-- remarketing_scores: bonus/penalty tracking
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS thesis_alignment_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_quality_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kpi_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_penalty INTEGER DEFAULT 0;

-- remarketing_scores: disqualification + review flags
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS is_disqualified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- remarketing_scores: data quality / confidence
ALTER TABLE remarketing_scores
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[],
  ADD COLUMN IF NOT EXISTS confidence_level TEXT;

-- Tier constraint: allow A/B/C/D/F
DO $$ BEGIN
  BEGIN
    ALTER TABLE remarketing_scores DROP CONSTRAINT IF EXISTS remarketing_scores_tier_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;
ALTER TABLE remarketing_scores
  ADD CONSTRAINT remarketing_scores_tier_check
  CHECK (tier IS NULL OR tier IN ('A', 'B', 'C', 'D', 'F'));

-- industry_trackers: geography mode + service adjacency
ALTER TABLE industry_trackers
  ADD COLUMN IF NOT EXISTS geography_mode TEXT DEFAULT 'critical',
  ADD COLUMN IF NOT EXISTS service_adjacency_map JSONB DEFAULT NULL;

DO $$ BEGIN
  BEGIN
    ALTER TABLE industry_trackers DROP CONSTRAINT IF EXISTS industry_trackers_geography_mode_check;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;
ALTER TABLE industry_trackers
  ADD CONSTRAINT industry_trackers_geography_mode_check
  CHECK (geography_mode IS NULL OR geography_mode IN ('critical', 'preferred', 'minimal'));

-- buyer_learning_history: score at decision time
ALTER TABLE buyer_learning_history
  ADD COLUMN IF NOT EXISTS score_at_decision INTEGER;

-- deal_scoring_adjustments: structured columns
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

-- buyer_deal_scores (legacy): matching columns
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_composite ON remarketing_scores (composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_disqualified ON remarketing_scores (listing_id, is_disqualified) WHERE is_disqualified = true;
CREATE INDEX IF NOT EXISTS idx_remarketing_scores_needs_review ON remarketing_scores (listing_id, needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_learning_history_buyer_action ON buyer_learning_history (buyer_id, action);