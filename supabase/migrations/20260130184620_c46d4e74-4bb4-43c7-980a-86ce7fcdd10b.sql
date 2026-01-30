-- Add GA4 client ID and first-touch attribution columns to user_sessions
ALTER TABLE user_sessions 
  ADD COLUMN IF NOT EXISTS ga4_client_id TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_source TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_medium TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_campaign TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_landing_page TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_referrer TEXT;

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_ga4_client_id ON user_sessions(ga4_client_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_first_touch_source ON user_sessions(first_touch_source);

-- Add comment for documentation
COMMENT ON COLUMN user_sessions.ga4_client_id IS 'GA4 client ID from _ga cookie for cross-platform data stitching';
COMMENT ON COLUMN user_sessions.first_touch_source IS 'First-touch UTM source for attribution analysis';
COMMENT ON COLUMN user_sessions.first_touch_medium IS 'First-touch UTM medium for attribution analysis';
COMMENT ON COLUMN user_sessions.first_touch_campaign IS 'First-touch UTM campaign for attribution analysis';
COMMENT ON COLUMN user_sessions.first_touch_landing_page IS 'First page path visited in first session';
COMMENT ON COLUMN user_sessions.first_touch_referrer IS 'Original referrer URL from first visit';