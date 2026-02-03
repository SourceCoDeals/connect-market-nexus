-- Score Training System Migration
-- Implements learning capabilities for deal quality scoring

-- =====================================================
-- 1. MANUAL SCORE OVERRIDES + DELTA TRACKING
-- =====================================================

-- Add manual override fields to listings
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS manual_score_override INTEGER CHECK (manual_score_override >= 0 AND manual_score_override <= 100),
ADD COLUMN IF NOT EXISTS score_override_reason TEXT,
ADD COLUMN IF NOT EXISTS score_override_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS score_override_at TIMESTAMPTZ;

-- Track all score overrides for learning
CREATE TABLE IF NOT EXISTS score_override_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  calculated_score INTEGER NOT NULL,
  manual_score INTEGER NOT NULL,
  delta INTEGER GENERATED ALWAYS AS (manual_score - calculated_score) STORED,
  reason TEXT,
  override_by UUID REFERENCES auth.users(id),
  -- Context at time of override (for learning)
  listing_ebitda NUMERIC,
  listing_revenue NUMERIC,
  listing_margin NUMERIC,
  listing_industry TEXT,
  listing_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_override_history_listing ON score_override_history(listing_id);
CREATE INDEX idx_score_override_history_industry ON score_override_history(listing_industry);
CREATE INDEX idx_score_override_history_delta ON score_override_history(delta);

-- =====================================================
-- 2. OUTCOME-BASED LEARNING (Closed Deals Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS deal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,

  -- Outcome details
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('closed', 'withdrawn', 'expired', 'rejected')),
  closed_at TIMESTAMPTZ,

  -- Deal terms
  final_price NUMERIC,
  asking_price NUMERIC,
  price_vs_asking_pct NUMERIC GENERATED ALWAYS AS (
    CASE WHEN asking_price > 0 THEN ROUND((final_price / asking_price) * 100, 1) ELSE NULL END
  ) STORED,

  -- Timeline
  days_on_market INTEGER,
  days_to_close INTEGER,

  -- Scores at time of close
  deal_score_at_close INTEGER,
  calculated_score_at_close INTEGER,

  -- Buyer info
  buyer_id UUID REFERENCES remarketing_buyers(id),
  buyer_type TEXT,

  -- Learning metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_deal_outcomes_listing ON deal_outcomes(listing_id);
CREATE INDEX idx_deal_outcomes_type ON deal_outcomes(outcome_type);
CREATE INDEX idx_deal_outcomes_closed_at ON deal_outcomes(closed_at);

-- =====================================================
-- 3. BUYER FEEDBACK LOOP
-- =====================================================

-- Track buyer pass/approve patterns for score calibration
CREATE TABLE IF NOT EXISTS score_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES remarketing_buyers(id),

  -- Feedback
  action TEXT NOT NULL CHECK (action IN ('approved', 'passed', 'interested', 'not_interested')),
  feedback_reason TEXT,
  pass_category TEXT, -- 'too_small', 'wrong_geography', 'wrong_industry', 'price_too_high', etc.

  -- Scores at time of feedback
  deal_score_at_feedback INTEGER,
  buyer_fit_score INTEGER,

  -- Context
  listing_ebitda NUMERIC,
  listing_industry TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_feedback_listing ON score_feedback(listing_id);
CREATE INDEX idx_score_feedback_buyer ON score_feedback(buyer_id);
CREATE INDEX idx_score_feedback_action ON score_feedback(action);
CREATE INDEX idx_score_feedback_pass_category ON score_feedback(pass_category);

-- =====================================================
-- 4. INDUSTRY-SPECIFIC ADJUSTMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS industry_score_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL UNIQUE,

  -- Adjustment values
  score_adjustment INTEGER DEFAULT 0, -- +/- points to add to base score
  margin_threshold_adjustment NUMERIC DEFAULT 0, -- Adjust margin expectations
  size_multiplier NUMERIC DEFAULT 1.0, -- Multiply size score

  -- Learning data
  avg_override_delta NUMERIC, -- Average delta from manual overrides
  sample_size INTEGER DEFAULT 0, -- How many deals used to calculate
  confidence TEXT DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),

  -- Audit
  last_calculated_at TIMESTAMPTZ,
  manually_set BOOLEAN DEFAULT FALSE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common industries
INSERT INTO industry_score_adjustments (industry, notes) VALUES
  ('Home Services', 'HVAC, Plumbing, Electrical - typically stable recurring revenue'),
  ('Healthcare & Medical', 'Medical practices, dental, veterinary'),
  ('Technology & Software', 'SaaS, IT services, software development'),
  ('Construction', 'General contractors, specialty trades'),
  ('Automotive', 'Collision repair, dealerships, auto services'),
  ('Manufacturing', 'Industrial manufacturing, fabrication'),
  ('Professional Services', 'Accounting, legal, consulting'),
  ('Retail', 'Brick and mortar retail'),
  ('Food & Beverage', 'Restaurants, food manufacturing, distribution'),
  ('Transportation & Logistics', 'Trucking, warehousing, logistics')
ON CONFLICT (industry) DO NOTHING;

-- =====================================================
-- 5. SCORING WEIGHTS A/B TESTING
-- =====================================================

CREATE TABLE IF NOT EXISTS scoring_weight_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Weight configuration
  size_weight INTEGER DEFAULT 65 CHECK (size_weight >= 0 AND size_weight <= 100),
  quality_weight INTEGER DEFAULT 20 CHECK (quality_weight >= 0 AND quality_weight <= 100),
  completeness_weight INTEGER DEFAULT 8 CHECK (completeness_weight >= 0 AND completeness_weight <= 100),
  motivation_weight INTEGER DEFAULT 7 CHECK (motivation_weight >= 0 AND motivation_weight <= 100),

  -- A/B testing
  is_active BOOLEAN DEFAULT FALSE,
  is_control BOOLEAN DEFAULT FALSE, -- The baseline config
  test_percentage INTEGER DEFAULT 0, -- % of scores calculated with this config

  -- Performance metrics
  avg_buyer_approval_rate NUMERIC,
  avg_close_rate NUMERIC,
  avg_price_vs_asking NUMERIC,
  deals_scored INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default (control) config
INSERT INTO scoring_weight_configs (name, description, is_active, is_control) VALUES
  ('Default v1', 'Size-dominant scoring (65% size, 20% quality, 8% data, 7% motivation)', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. RECALIBRATION ANALYSIS RESULTS
-- =====================================================

CREATE TABLE IF NOT EXISTS score_calibration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW(),
  run_by UUID REFERENCES auth.users(id),

  -- Analysis period
  analysis_start_date DATE,
  analysis_end_date DATE,

  -- Sample sizes
  total_deals_analyzed INTEGER,
  deals_with_outcomes INTEGER,
  deals_with_overrides INTEGER,
  deals_with_feedback INTEGER,

  -- Findings
  avg_override_delta NUMERIC,
  avg_outcome_score_accuracy NUMERIC, -- How well scores predicted outcomes

  -- Recommendations (JSON)
  weight_recommendations JSONB,
  industry_recommendations JSONB,

  -- Status
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,

  notes TEXT
);

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to record a score override
CREATE OR REPLACE FUNCTION record_score_override()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.manual_score_override IS NOT NULL AND
     (OLD.manual_score_override IS NULL OR NEW.manual_score_override != OLD.manual_score_override) THEN
    INSERT INTO score_override_history (
      listing_id,
      calculated_score,
      manual_score,
      reason,
      override_by,
      listing_ebitda,
      listing_revenue,
      listing_margin,
      listing_industry,
      listing_location
    ) VALUES (
      NEW.id,
      COALESCE(NEW.deal_total_score, 0),
      NEW.manual_score_override,
      NEW.score_override_reason,
      NEW.score_override_by,
      NEW.ebitda,
      NEW.revenue,
      CASE WHEN NEW.revenue > 0 THEN NEW.ebitda / NEW.revenue ELSE NULL END,
      NEW.category,
      NEW.location
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-record overrides
DROP TRIGGER IF EXISTS trigger_record_score_override ON listings;
CREATE TRIGGER trigger_record_score_override
  AFTER UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION record_score_override();

-- Function to get effective score (manual override or calculated)
CREATE OR REPLACE FUNCTION get_effective_deal_score(listing_row listings)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(listing_row.manual_score_override, listing_row.deal_total_score, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 8. VIEWS FOR ANALYSIS
-- =====================================================

-- View: Override patterns by industry
CREATE OR REPLACE VIEW v_override_patterns_by_industry AS
SELECT
  listing_industry as industry,
  COUNT(*) as override_count,
  ROUND(AVG(delta), 1) as avg_delta,
  ROUND(STDDEV(delta), 1) as stddev_delta,
  MIN(delta) as min_delta,
  MAX(delta) as max_delta,
  ROUND(AVG(listing_ebitda), 0) as avg_ebitda,
  ROUND(AVG(listing_margin) * 100, 1) as avg_margin_pct
FROM score_override_history
WHERE listing_industry IS NOT NULL
GROUP BY listing_industry
HAVING COUNT(*) >= 3
ORDER BY override_count DESC;

-- View: Score accuracy by outcome
CREATE OR REPLACE VIEW v_score_accuracy_by_outcome AS
SELECT
  outcome_type,
  COUNT(*) as deal_count,
  ROUND(AVG(deal_score_at_close), 1) as avg_score,
  ROUND(AVG(price_vs_asking_pct), 1) as avg_price_vs_asking,
  ROUND(AVG(days_to_close), 0) as avg_days_to_close
FROM deal_outcomes
WHERE deal_score_at_close IS NOT NULL
GROUP BY outcome_type;

-- View: Buyer feedback summary
CREATE OR REPLACE VIEW v_buyer_feedback_summary AS
SELECT
  pass_category,
  COUNT(*) as feedback_count,
  ROUND(AVG(deal_score_at_feedback), 1) as avg_deal_score,
  ROUND(AVG(listing_ebitda), 0) as avg_ebitda
FROM score_feedback
WHERE action = 'passed' AND pass_category IS NOT NULL
GROUP BY pass_category
ORDER BY feedback_count DESC;

-- Enable RLS
ALTER TABLE score_override_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_score_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_calibration_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only for now)
CREATE POLICY "Admins can manage score_override_history" ON score_override_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage deal_outcomes" ON deal_outcomes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage score_feedback" ON score_feedback
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage industry_score_adjustments" ON industry_score_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage scoring_weight_configs" ON scoring_weight_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage score_calibration_runs" ON score_calibration_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
