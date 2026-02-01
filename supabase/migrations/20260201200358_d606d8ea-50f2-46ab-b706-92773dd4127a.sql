-- Drop the visitor_companies table (cleanup from RB2B/Warmly integration)
DROP TABLE IF EXISTS public.visitor_companies;

-- Create user_journeys table for cross-session visitor tracking
CREATE TABLE public.user_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity (can link anonymous → authenticated)
  visitor_id TEXT NOT NULL,
  ga4_client_id TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- First Touch (never changes after set)
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  first_landing_page TEXT,
  first_referrer TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_term TEXT,
  first_utm_content TEXT,
  first_device_type TEXT,
  first_browser TEXT,
  first_os TEXT,
  first_country TEXT,
  first_city TEXT,
  
  -- Latest Session Info (updated on each visit)
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_session_id TEXT,
  last_page_path TEXT,
  
  -- Aggregates
  total_sessions INTEGER DEFAULT 1,
  total_page_views INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  
  -- Conversion Milestones (JSONB for flexibility)
  milestones JSONB DEFAULT '{}'::jsonb,
  
  -- Journey Status: anonymous, registered, engaged, qualified, converted
  journey_stage TEXT DEFAULT 'anonymous',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one journey per visitor
  CONSTRAINT unique_visitor_id UNIQUE (visitor_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_journeys_visitor ON public.user_journeys(visitor_id);
CREATE INDEX idx_user_journeys_ga4 ON public.user_journeys(ga4_client_id) WHERE ga4_client_id IS NOT NULL;
CREATE INDEX idx_user_journeys_user ON public.user_journeys(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_journeys_stage ON public.user_journeys(journey_stage);
CREATE INDEX idx_user_journeys_first_seen ON public.user_journeys(first_seen_at DESC);
CREATE INDEX idx_user_journeys_last_seen ON public.user_journeys(last_seen_at DESC);
CREATE INDEX idx_user_journeys_first_source ON public.user_journeys(first_utm_source) WHERE first_utm_source IS NOT NULL;

-- Enable RLS
ALTER TABLE public.user_journeys ENABLE ROW LEVEL SECURITY;

-- Admins can read all journeys
CREATE POLICY "Admins can view all journeys"
ON public.user_journeys
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Edge functions (service role) can insert/update
CREATE POLICY "Service role can manage journeys"
ON public.user_journeys
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_journeys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_user_journeys_updated_at
BEFORE UPDATE ON public.user_journeys
FOR EACH ROW
EXECUTE FUNCTION public.update_user_journeys_updated_at();

-- Grant permissions to service role for edge functions
GRANT ALL ON public.user_journeys TO service_role;
GRANT SELECT ON public.user_journeys TO authenticated;