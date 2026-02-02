-- Add original_source fields to user_sessions for complete attribution tracking
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_source text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_keyword text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS blog_landing_page text;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS original_external_referrer text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_original_source ON user_sessions(original_source);

-- Comment explaining the columns
COMMENT ON COLUMN user_sessions.original_source IS 'Self-reported source from profiles.referral_source (e.g., Google, LinkedIn)';
COMMENT ON COLUMN user_sessions.original_keyword IS 'Self-reported keyword from profiles.referral_source_detail (e.g., M&A deal sourcing)';
COMMENT ON COLUMN user_sessions.blog_landing_page IS 'Landing page on main site before redirecting to marketplace';
COMMENT ON COLUMN user_sessions.original_external_referrer IS 'External referrer before landing on sourcecodeals.com (passed via URL param)';