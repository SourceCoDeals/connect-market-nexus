-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Add firm_id columns and triggers
-- Part 1: Schema additions
-- ============================================================================

-- Add firm_id to inbound_leads table
ALTER TABLE public.inbound_leads 
ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL;

-- Add firm_id to connection_requests table  
ALTER TABLE public.connection_requests
ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firm_agreements(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbound_leads_firm_id ON public.inbound_leads(firm_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_firm_id ON public.connection_requests(firm_id);

-- Add indexes for matching performance
CREATE INDEX IF NOT EXISTS idx_inbound_leads_email_domain 
  ON public.inbound_leads((extract_domain(email))) 
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_leads_company_name 
  ON public.inbound_leads((normalize_company_name(company_name))) 
  WHERE company_name IS NOT NULL;