-- Add UTM tracking columns to page_views table
ALTER TABLE page_views
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Add UTM tracking columns to listing_analytics table
ALTER TABLE listing_analytics
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Add UTM tracking columns to user_sessions table
ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Add UTM tracking columns to user_events table
ALTER TABLE user_events
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_term TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Create indexes for better query performance on UTM tracking
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_campaign ON page_views(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_utm_source ON listing_analytics(utm_source);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_utm_campaign ON listing_analytics(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_user_sessions_utm_source ON user_sessions(utm_source);
CREATE INDEX IF NOT EXISTS idx_user_sessions_utm_campaign ON user_sessions(utm_campaign);