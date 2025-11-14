-- Similar deal alerts table
CREATE TABLE IF NOT EXISTS similar_deal_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  locations TEXT[] NOT NULL DEFAULT '{}',
  revenue_min BIGINT,
  revenue_max BIGINT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interest signals table (anonymous interest)
CREATE TABLE IF NOT EXISTS interest_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_to_connection BOOLEAN NOT NULL DEFAULT false,
  converted_at TIMESTAMPTZ,
  UNIQUE(listing_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_similar_deal_alerts_user_id ON similar_deal_alerts(user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_similar_deal_alerts_categories ON similar_deal_alerts USING GIN(categories) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_interest_signals_listing_id ON interest_signals(listing_id);
CREATE INDEX IF NOT EXISTS idx_interest_signals_user_id ON interest_signals(user_id);

-- RLS policies for similar_deal_alerts
ALTER TABLE similar_deal_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alerts"
  ON similar_deal_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts"
  ON similar_deal_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON similar_deal_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON similar_deal_alerts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts"
  ON similar_deal_alerts FOR SELECT
  USING (is_admin(auth.uid()));

-- RLS policies for interest_signals
ALTER TABLE interest_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interest signals"
  ON interest_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own interest signals"
  ON interest_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interest signals"
  ON interest_signals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all interest signals"
  ON interest_signals FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view aggregate interest per listing"
  ON interest_signals FOR SELECT
  USING (is_admin(auth.uid()));