-- Add is_bot and is_production columns to user_journeys table
ALTER TABLE user_journeys 
ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_production BOOLEAN DEFAULT true;

-- Backfill from user_sessions using the visitor's first session
UPDATE user_journeys uj
SET 
  is_bot = COALESCE((
    SELECT us.is_bot 
    FROM user_sessions us 
    WHERE us.visitor_id = uj.visitor_id 
    ORDER BY us.started_at ASC 
    LIMIT 1
  ), false),
  is_production = COALESCE((
    SELECT us.is_production 
    FROM user_sessions us 
    WHERE us.visitor_id = uj.visitor_id 
    ORDER BY us.started_at ASC 
    LIMIT 1
  ), true);

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_journeys_is_bot ON user_journeys(is_bot);
CREATE INDEX IF NOT EXISTS idx_user_journeys_is_production ON user_journeys(is_production);
CREATE INDEX IF NOT EXISTS idx_user_journeys_bot_prod ON user_journeys(is_bot, is_production);