-- Add new columns for comprehensive session tracking
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Add time_on_page and scroll_depth to page_views if not exists
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS time_on_page INTEGER;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS scroll_depth INTEGER;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS exit_page BOOLEAN DEFAULT FALSE;

-- Add clicked_elements JSONB to listing_analytics if not exists
ALTER TABLE listing_analytics ADD COLUMN IF NOT EXISTS clicked_elements JSONB;

-- Add search enhancement columns
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS time_to_click INTEGER;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS position_clicked INTEGER;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS search_session_id TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
  ON user_sessions(is_active, last_active_at) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_sessions_geo 
  ON user_sessions(country, city) 
  WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_started 
  ON user_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_session_time 
  ON page_views(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_analytics_session 
  ON listing_analytics(session_id, created_at DESC);