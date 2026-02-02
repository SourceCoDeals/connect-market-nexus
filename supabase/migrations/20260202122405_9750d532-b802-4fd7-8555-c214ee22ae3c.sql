-- Add visitor_id to user_sessions for cross-session anonymous user tracking
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- Create index for fast lookups by visitor_id
CREATE INDEX IF NOT EXISTS idx_user_sessions_visitor_id ON user_sessions(visitor_id) WHERE visitor_id IS NOT NULL;