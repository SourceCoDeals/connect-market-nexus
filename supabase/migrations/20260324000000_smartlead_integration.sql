-- Smartlead integration tables
-- Tracks campaigns synced with Smartlead and maps leads to platform contacts

-- ─── Campaign sync tracking ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smartlead_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartlead_campaign_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFTED',
  deal_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  universe_id UUID REFERENCES remarketing_buyer_universes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  lead_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE smartlead_campaigns IS 'Tracks Smartlead campaigns linked to platform deals/universes';

-- ─── Lead sync tracking ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smartlead_campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES smartlead_campaigns(id) ON DELETE CASCADE,
  smartlead_lead_id BIGINT,
  -- Link to platform contacts (one of these will be set)
  buyer_contact_id UUID REFERENCES buyer_contacts(id) ON DELETE SET NULL,
  remarketing_buyer_id UUID,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  -- Smartlead lead status tracking
  lead_status TEXT DEFAULT 'pending',
  lead_category TEXT,
  last_activity_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, email)
);

COMMENT ON TABLE smartlead_campaign_leads IS 'Maps platform contacts to Smartlead campaign leads';

-- ─── Campaign statistics snapshots ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smartlead_campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES smartlead_campaigns(id) ON DELETE CASCADE,
  total_leads INTEGER DEFAULT 0,
  sent INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  bounced INTEGER DEFAULT 0,
  unsubscribed INTEGER DEFAULT 0,
  interested INTEGER DEFAULT 0,
  not_interested INTEGER DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE smartlead_campaign_stats IS 'Periodic snapshots of Smartlead campaign statistics';

-- ─── Webhook event log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS smartlead_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartlead_campaign_id BIGINT,
  event_type TEXT NOT NULL,
  lead_email TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE smartlead_webhook_events IS 'Incoming webhook events from Smartlead';

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_smartlead_campaigns_deal ON smartlead_campaigns(deal_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_campaigns_universe ON smartlead_campaigns(universe_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_campaigns_status ON smartlead_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_smartlead_leads_campaign ON smartlead_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_leads_email ON smartlead_campaign_leads(email);
CREATE INDEX IF NOT EXISTS idx_smartlead_leads_buyer_contact ON smartlead_campaign_leads(buyer_contact_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_stats_campaign ON smartlead_campaign_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_smartlead_webhook_type ON smartlead_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_smartlead_webhook_processed ON smartlead_webhook_events(processed) WHERE NOT processed;

-- ─── Updated-at triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_smartlead_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_smartlead_campaigns_updated
  BEFORE UPDATE ON smartlead_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_smartlead_updated_at();

CREATE TRIGGER trg_smartlead_leads_updated
  BEFORE UPDATE ON smartlead_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION update_smartlead_updated_at();

-- ─── RLS Policies ──────────────────────────────────────────────────────────

ALTER TABLE smartlead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartlead_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartlead_campaign_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartlead_webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role bypasses RLS; these policies allow admin users via the app)
CREATE POLICY smartlead_campaigns_admin ON smartlead_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY smartlead_leads_admin ON smartlead_campaign_leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY smartlead_stats_admin ON smartlead_campaign_stats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY smartlead_webhook_admin ON smartlead_webhook_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );
