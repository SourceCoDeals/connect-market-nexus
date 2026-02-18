-- ============================================================
-- Valuation Calculator Leads table
-- Staging table for leads from SourceCo valuation calculators
-- ============================================================

CREATE TABLE IF NOT EXISTS valuation_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Calculator metadata
  calculator_type TEXT NOT NULL DEFAULT 'general',
  display_name TEXT,

  -- Contact info
  email TEXT UNIQUE,
  full_name TEXT,
  business_name TEXT,
  website TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Business details
  industry TEXT,
  region TEXT,
  location TEXT,
  revenue NUMERIC(14, 2),
  ebitda NUMERIC(14, 2),
  valuation_low NUMERIC(14, 2),
  valuation_mid NUMERIC(14, 2),
  valuation_high NUMERIC(14, 2),

  -- Quality & motivation (general calculator)
  quality_tier TEXT,
  quality_label TEXT,
  exit_timing TEXT,
  open_to_intros BOOLEAN,
  cta_clicked BOOLEAN,
  readiness_score INTEGER,

  -- Business characteristics
  growth_trend TEXT,
  owner_dependency TEXT,
  locations_count INTEGER,
  buyer_lane TEXT,
  revenue_model TEXT,

  -- Calculator-specific JSONB fields
  calculator_specific_data JSONB DEFAULT '{}',
  raw_calculator_inputs JSONB DEFAULT '{}',
  raw_valuation_results JSONB DEFAULT '{}',

  -- Scoring
  lead_score INTEGER,
  scoring_notes TEXT,

  -- Push to All Deals workflow
  pushed_to_all_deals BOOLEAN DEFAULT false,
  pushed_to_all_deals_at TIMESTAMPTZ,
  pushed_listing_id UUID REFERENCES listings(id),

  -- Status / tracking
  status TEXT DEFAULT 'new',
  lead_source TEXT,
  source_submission_id TEXT,
  excluded BOOLEAN DEFAULT false,
  exclusion_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_valuation_leads_calculator_type ON valuation_leads (calculator_type);
CREATE INDEX idx_valuation_leads_excluded ON valuation_leads (excluded);
CREATE INDEX idx_valuation_leads_pushed ON valuation_leads (pushed_to_all_deals);
CREATE INDEX idx_valuation_leads_score ON valuation_leads (lead_score DESC NULLS LAST);
CREATE INDEX idx_valuation_leads_created ON valuation_leads (created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_valuation_leads_updated_at
  BEFORE UPDATE ON valuation_leads
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================
-- Display name trigger: auto-generate sequential names
-- e.g. "General Calculator #1", "Auto Shop Calculator #2"
-- ============================================================

CREATE OR REPLACE FUNCTION generate_valuation_display_name()
RETURNS TRIGGER AS $$
DECLARE
  type_label TEXT;
  seq_num INTEGER;
BEGIN
  type_label := CASE NEW.calculator_type
    WHEN 'general' THEN 'General Calculator'
    WHEN 'auto_shop' THEN 'Auto Shop Calculator'
    WHEN 'hvac' THEN 'HVAC Calculator'
    WHEN 'collision' THEN 'Collision Calculator'
    ELSE initcap(replace(NEW.calculator_type, '_', ' ')) || ' Calculator'
  END;

  SELECT COALESCE(MAX(
    CAST(regexp_replace(display_name, '.*#', '') AS INTEGER)
  ), 0) + 1 INTO seq_num
  FROM valuation_leads
  WHERE calculator_type = NEW.calculator_type
    AND display_name IS NOT NULL;

  NEW.display_name := type_label || ' #' || seq_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_valuation_display_name
  BEFORE INSERT ON valuation_leads
  FOR EACH ROW
  WHEN (NEW.display_name IS NULL)
  EXECUTE FUNCTION generate_valuation_display_name();

-- RLS (admin-only access)
ALTER TABLE valuation_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to valuation_leads"
  ON valuation_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role bypass for valuation_leads"
  ON valuation_leads
  FOR ALL
  USING (auth.role() = 'service_role');
