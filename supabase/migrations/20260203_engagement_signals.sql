-- Engagement Signal Tracking
-- Tracks buyer interaction signals that boost match priority
-- Used to elevate engaged buyers (site visits, financial requests, NDA, etc.)

CREATE TABLE IF NOT EXISTS engagement_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES remarketing_buyers(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'site_visit',
    'financial_request',
    'ceo_involvement',
    'nda_signed',
    'ioi_submitted',
    'loi_submitted',
    'call_scheduled',
    'management_presentation',
    'data_room_access',
    'email_engagement'
  )),
  signal_value INTEGER NOT NULL DEFAULT 0,
  signal_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN (
    'manual',
    'email_tracking',
    'crm_integration',
    'system_detected'
  )),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, buyer_id, signal_type, signal_date)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_engagement_signals_listing ON engagement_signals(listing_id);
CREATE INDEX IF NOT EXISTS idx_engagement_signals_buyer ON engagement_signals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_signals_pair ON engagement_signals(listing_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_engagement_signals_date ON engagement_signals(signal_date DESC);

-- Calculate total engagement score for a listing-buyer pair
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  p_listing_id UUID,
  p_buyer_id UUID
) RETURNS INTEGER AS $$
DECLARE
  total_score INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(signal_value), 0)
  INTO total_score
  FROM engagement_signals
  WHERE listing_id = p_listing_id
    AND buyer_id = p_buyer_id;

  -- Cap at 100 points per spec
  RETURN LEAST(total_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the table
COMMENT ON TABLE engagement_signals IS 'Tracks buyer engagement signals (site visits, NDAs, IOIs, LOIs) to prioritize active buyers in scoring. Signals add 0-100 bonus points to match scores.';
COMMENT ON COLUMN engagement_signals.signal_value IS 'Point value for this signal type. Typical values: site_visit=20, financial_request=30, nda_signed=25, ceo_involvement=40, ioi_submitted=60, loi_submitted=100';
COMMENT ON COLUMN engagement_signals.source IS 'How this signal was captured: manual (admin entry), email_tracking (automated), crm_integration (from CRM), system_detected (auto-detected from logs)';

-- RLS Policies
ALTER TABLE engagement_signals ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access to engagement signals"
  ON engagement_signals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'admin'
           OR auth.users.raw_user_meta_data->>'role' = 'super_admin')
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
  ON engagement_signals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
