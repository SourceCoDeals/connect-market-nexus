-- HeyReach integration tables
-- Tracks LinkedIn outreach campaigns synced with HeyReach and maps leads to platform contacts
-- Mirrors the Smartlead integration pattern for consistency

-- ─── Campaign sync tracking ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heyreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heyreach_campaign_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  deal_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  universe_id UUID REFERENCES remarketing_buyer_universes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  lead_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE heyreach_campaigns IS 'Tracks HeyReach LinkedIn outreach campaigns linked to platform deals/universes';

-- ─── Lead sync tracking ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heyreach_campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES heyreach_campaigns(id) ON DELETE CASCADE,
  heyreach_lead_id TEXT,
  -- Link to platform contacts (one of these will be set)
  buyer_contact_id UUID REFERENCES buyer_contacts(id) ON DELETE SET NULL,
  remarketing_buyer_id UUID,
  linkedin_url TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  -- HeyReach lead status tracking
  lead_status TEXT DEFAULT 'pending',
  lead_category TEXT,
  last_activity_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, linkedin_url)
);

COMMENT ON TABLE heyreach_campaign_leads IS 'Maps platform contacts to HeyReach campaign leads (LinkedIn-based)';

-- ─── Campaign statistics snapshots ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heyreach_campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES heyreach_campaigns(id) ON DELETE CASCADE,
  total_leads INTEGER DEFAULT 0,
  contacted INTEGER DEFAULT 0,
  connected INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  interested INTEGER DEFAULT 0,
  not_interested INTEGER DEFAULT 0,
  response_rate NUMERIC(5, 2) DEFAULT 0,
  connection_rate NUMERIC(5, 2) DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE heyreach_campaign_stats IS 'Periodic snapshots of HeyReach campaign statistics';

-- ─── Webhook event log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heyreach_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heyreach_campaign_id BIGINT,
  event_type TEXT NOT NULL,
  lead_linkedin_url TEXT,
  lead_email TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE heyreach_webhook_events IS 'Incoming webhook events from HeyReach';

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_heyreach_campaigns_deal ON heyreach_campaigns(deal_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_campaigns_universe ON heyreach_campaigns(universe_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_campaigns_status ON heyreach_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_heyreach_leads_campaign ON heyreach_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_leads_linkedin ON heyreach_campaign_leads(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_heyreach_leads_email ON heyreach_campaign_leads(email);
CREATE INDEX IF NOT EXISTS idx_heyreach_leads_buyer_contact ON heyreach_campaign_leads(buyer_contact_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_stats_campaign ON heyreach_campaign_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_heyreach_webhook_type ON heyreach_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_heyreach_webhook_processed ON heyreach_webhook_events(processed) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_heyreach_webhook_linkedin ON heyreach_webhook_events(lead_linkedin_url);
CREATE INDEX IF NOT EXISTS idx_heyreach_webhook_email ON heyreach_webhook_events(lead_email);

-- ─── Updated-at triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_heyreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_heyreach_campaigns_updated
  BEFORE UPDATE ON heyreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_heyreach_updated_at();

CREATE TRIGGER trg_heyreach_leads_updated
  BEFORE UPDATE ON heyreach_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION update_heyreach_updated_at();

-- ─── RLS Policies ──────────────────────────────────────────────────────────

ALTER TABLE heyreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE heyreach_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE heyreach_campaign_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE heyreach_webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role bypasses RLS; these policies allow admin users via the app)
CREATE POLICY heyreach_campaigns_admin ON heyreach_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY heyreach_leads_admin ON heyreach_campaign_leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY heyreach_stats_admin ON heyreach_campaign_stats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY heyreach_webhook_admin ON heyreach_webhook_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );
