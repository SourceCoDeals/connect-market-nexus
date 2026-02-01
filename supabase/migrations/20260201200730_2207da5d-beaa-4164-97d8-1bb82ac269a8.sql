-- Create a function to increment journey session count and update last activity
CREATE OR REPLACE FUNCTION public.increment_journey_sessions(
  p_visitor_id TEXT,
  p_session_id TEXT,
  p_page_path TEXT DEFAULT '/'
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_journeys
  SET 
    total_sessions = total_sessions + 1,
    last_seen_at = NOW(),
    last_session_id = p_session_id,
    last_page_path = p_page_path,
    updated_at = NOW()
  WHERE visitor_id = p_visitor_id
    AND last_session_id != p_session_id; -- Only increment if it's actually a new session
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_journey_sessions TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_journey_sessions TO authenticated;