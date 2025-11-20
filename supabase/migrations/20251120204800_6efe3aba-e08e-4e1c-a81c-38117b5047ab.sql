-- Create table to track when each admin last viewed the Deal Sourcing page
CREATE TABLE IF NOT EXISTS admin_deal_sourcing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_id)
);

-- Index for fast lookups
CREATE INDEX idx_admin_deal_sourcing_views_admin_id ON admin_deal_sourcing_views(admin_id);
CREATE INDEX idx_admin_deal_sourcing_views_last_viewed ON admin_deal_sourcing_views(last_viewed_at);

-- Enable RLS
ALTER TABLE admin_deal_sourcing_views ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can only view/update their own record
CREATE POLICY "Admins can manage their own view records"
  ON admin_deal_sourcing_views
  FOR ALL
  USING (admin_id = auth.uid());

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE admin_deal_sourcing_views;