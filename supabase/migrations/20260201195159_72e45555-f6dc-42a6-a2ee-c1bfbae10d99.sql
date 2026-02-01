-- Create visitor_companies table for RB2B/Warmly identification data
CREATE TABLE public.visitor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Visitor identification
  session_id TEXT,
  captured_url TEXT,
  seen_at TIMESTAMPTZ,
  referrer TEXT,
  
  -- Person data (from RB2B/Warmly)
  linkedin_url TEXT,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  business_email TEXT,
  
  -- Company data
  company_name TEXT,
  company_website TEXT,
  company_industry TEXT,
  company_size TEXT,
  estimated_revenue TEXT,
  company_city TEXT,
  company_state TEXT,
  company_country TEXT,
  
  -- Metadata
  source TEXT CHECK (source IN ('rb2b', 'warmly', 'manual')),
  is_repeat_visit BOOLEAN DEFAULT FALSE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.visitor_companies ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only (using is_admin column)
CREATE POLICY "Admin users can view visitor companies"
ON public.visitor_companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
);

-- Create indexes for fast lookups
CREATE INDEX idx_visitor_companies_company ON public.visitor_companies(company_name);
CREATE INDEX idx_visitor_companies_seen_at ON public.visitor_companies(seen_at DESC);
CREATE INDEX idx_visitor_companies_source ON public.visitor_companies(source);
CREATE INDEX idx_visitor_companies_created_at ON public.visitor_companies(created_at DESC);

-- Add comments
COMMENT ON TABLE public.visitor_companies IS 'Stores visitor identification data from RB2B and Warmly webhooks';
COMMENT ON COLUMN public.visitor_companies.source IS 'Data source: rb2b, warmly, or manual';