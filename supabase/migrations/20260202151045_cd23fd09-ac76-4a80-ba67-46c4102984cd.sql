-- Phase 1: Add unique_visitors column to daily_metrics
ALTER TABLE public.daily_metrics 
ADD COLUMN IF NOT EXISTS unique_visitors INTEGER DEFAULT 0;

-- Phase 2: Add UNIQUE constraint on user_sessions.session_id to prevent race condition duplicates
-- First, let's clean up any duplicate session_ids (keep the earliest one)
DELETE FROM user_sessions a
USING user_sessions b
WHERE a.id > b.id AND a.session_id = b.session_id;

-- Now add the unique constraint
ALTER TABLE public.user_sessions 
ADD CONSTRAINT user_sessions_session_id_unique UNIQUE (session_id);

-- Add comment documenting the metrics
COMMENT ON COLUMN daily_metrics.unique_visitors IS 'Count of unique people (by visitor_id or user_id), not sessions';
COMMENT ON COLUMN daily_metrics.total_sessions IS 'Count of unique session_ids, one person may have multiple sessions';