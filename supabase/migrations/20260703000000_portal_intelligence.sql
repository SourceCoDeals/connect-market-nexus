-- Portal Intelligence Upgrade
-- Per-industry thesis criteria, deal recommendations, intelligence docs, pass reason tracking

-- ================================================================
-- Table 1: portal_thesis_criteria
-- Per-industry targeting criteria for a portal client
-- ================================================================
CREATE TABLE IF NOT EXISTS portal_thesis_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_org_id UUID NOT NULL REFERENCES portal_organizations(id) ON DELETE CASCADE,

  -- Industry targeting
  industry_label TEXT NOT NULL,
  industry_keywords TEXT[] NOT NULL DEFAULT '{}',

  -- Size criteria for THIS industry
  ebitda_min INTEGER,
  ebitda_max INTEGER,
  revenue_min INTEGER,
  revenue_max INTEGER,
  employee_min INTEGER,
  employee_max INTEGER,

  -- Geography for THIS industry
  target_states TEXT[] DEFAULT '{}',

  -- Links to buyer system (soft references — no FK constraints)
  portfolio_buyer_id UUID,
  universe_id UUID,

  -- Control
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE portal_thesis_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage thesis criteria"
  ON portal_thesis_criteria FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Portal users can view own org criteria"
  ON portal_thesis_criteria FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM portal_users
    WHERE portal_users.portal_org_id = portal_thesis_criteria.portal_org_id
      AND portal_users.profile_id = auth.uid()
      AND portal_users.is_active = true
  ));

CREATE INDEX idx_ptc_org ON portal_thesis_criteria(portal_org_id) WHERE is_active = TRUE;
CREATE INDEX idx_ptc_portfolio ON portal_thesis_criteria(portfolio_buyer_id) WHERE portfolio_buyer_id IS NOT NULL;

-- ================================================================
-- Table 2: portal_intelligence_docs
-- Transcripts, meeting notes, thesis documents
-- ================================================================
CREATE TABLE IF NOT EXISTS portal_intelligence_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_org_id UUID NOT NULL REFERENCES portal_organizations(id) ON DELETE CASCADE,

  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'call_transcript', 'meeting_notes', 'thesis_document', 'pass_notes', 'general_notes'
  )),

  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,

  fireflies_transcript_id TEXT,
  listing_id UUID,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE portal_intelligence_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage intelligence docs"
  ON portal_intelligence_docs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE INDEX idx_pid_org ON portal_intelligence_docs(portal_org_id);
CREATE INDEX idx_pid_type ON portal_intelligence_docs(portal_org_id, doc_type);

-- ================================================================
-- Table 3: portal_deal_recommendations
-- Deals matched to portal thesis criteria, pending admin review
-- ================================================================
CREATE TABLE IF NOT EXISTS portal_deal_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_org_id UUID NOT NULL REFERENCES portal_organizations(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  thesis_criteria_id UUID REFERENCES portal_thesis_criteria(id) ON DELETE SET NULL,

  portfolio_buyer_id UUID,
  portfolio_company_name TEXT,

  match_score INTEGER NOT NULL,
  match_reasons TEXT[],
  match_category TEXT NOT NULL CHECK (match_category IN ('strong', 'moderate', 'weak')),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'pushed', 'dismissed'
  )),

  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  dismiss_reason TEXT,
  push_id UUID,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(portal_org_id, listing_id)
);

ALTER TABLE portal_deal_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recommendations"
  ON portal_deal_recommendations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE INDEX idx_pdr_org_status ON portal_deal_recommendations(portal_org_id, status);
CREATE INDEX idx_pdr_listing ON portal_deal_recommendations(listing_id);
CREATE INDEX idx_pdr_score ON portal_deal_recommendations(match_score DESC);

-- ================================================================
-- Table 4: portal_recommendation_queue
-- Background processing queue for deal-thesis matching
-- ================================================================
CREATE TABLE IF NOT EXISTS portal_recommendation_queue (
  listing_id UUID NOT NULL PRIMARY KEY,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- Column addition: pass_reason_category on portal_deal_responses
-- ================================================================
ALTER TABLE portal_deal_responses
  ADD COLUMN IF NOT EXISTS pass_reason_category TEXT CHECK (
    pass_reason_category IS NULL OR pass_reason_category IN (
      'too_small', 'too_large', 'wrong_geography', 'wrong_industry',
      'owner_dependency', 'already_in_discussions', 'not_cultural_fit',
      'timing_not_right', 'other'
    )
  );

-- ================================================================
-- Triggers
-- ================================================================

-- Queue deals for recommendation evaluation on INSERT
CREATE OR REPLACE FUNCTION queue_portal_recommendation()
RETURNS trigger AS $$
BEGIN
  -- Only queue if active portal thesis criteria exist
  IF EXISTS (
    SELECT 1 FROM portal_thesis_criteria ptc
    JOIN portal_organizations po ON ptc.portal_org_id = po.id
    WHERE ptc.is_active = TRUE AND po.status = 'active'
    LIMIT 1
  ) THEN
    INSERT INTO portal_recommendation_queue (listing_id, queued_at)
    VALUES (NEW.id, now())
    ON CONFLICT (listing_id) DO UPDATE SET queued_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_portal_reco_new_deal
  AFTER INSERT ON listings
  FOR EACH ROW EXECUTE FUNCTION queue_portal_recommendation();

CREATE TRIGGER trg_portal_reco_deal_update
  AFTER UPDATE OF industry, category, address_state, ebitda, revenue,
    linkedin_employee_count, services, categories, executive_summary,
    deal_total_score, enriched_at
  ON listings
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION queue_portal_recommendation();

-- Updated_at triggers
CREATE TRIGGER update_portal_thesis_criteria_updated_at
  BEFORE UPDATE ON portal_thesis_criteria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_intelligence_docs_updated_at
  BEFORE UPDATE ON portal_intelligence_docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_deal_recommendations_updated_at
  BEFORE UPDATE ON portal_deal_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
