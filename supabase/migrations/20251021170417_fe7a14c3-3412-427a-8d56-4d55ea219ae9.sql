-- Create user_initial_session table to store first-time user tracking data
CREATE TABLE IF NOT EXISTS public.user_initial_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  session_id text,
  referrer text,
  full_referrer text,
  landing_page text,
  landing_page_query text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  location jsonb,
  browser text,
  device_type text,
  platform text,
  browser_type text,
  marketing_channel text,
  first_seen_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_initial_session ENABLE ROW LEVEL SECURITY;

-- Admins can view all initial session data
CREATE POLICY "Admins can view all initial session data"
ON public.user_initial_session
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- System can insert initial session data
CREATE POLICY "System can insert initial session data"
ON public.user_initial_session
FOR INSERT
TO authenticated
WITH CHECK (true);

-- System can update initial session data
CREATE POLICY "System can update initial session data"
ON public.user_initial_session
FOR UPDATE
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_initial_session_user_id ON public.user_initial_session(user_id);
CREATE INDEX IF NOT EXISTS idx_user_initial_session_created_at ON public.user_initial_session(created_at DESC);