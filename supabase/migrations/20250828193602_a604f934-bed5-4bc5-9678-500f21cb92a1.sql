-- Phase 1: Data Model Changes for Lead-Only Connection Requests

-- Make user_id nullable in connection_requests to support lead-only requests
ALTER TABLE public.connection_requests 
ALTER COLUMN user_id DROP NOT NULL;

-- Add lead information columns for when user_id is null
ALTER TABLE public.connection_requests 
ADD COLUMN lead_email TEXT,
ADD COLUMN lead_name TEXT, 
ADD COLUMN lead_company TEXT,
ADD COLUMN lead_role TEXT;

-- Add a check constraint to ensure either user_id exists OR lead_email exists
ALTER TABLE public.connection_requests 
ADD CONSTRAINT check_user_or_lead_info 
CHECK (
  (user_id IS NOT NULL) OR 
  (lead_email IS NOT NULL AND lead_name IS NOT NULL)
);

-- Update existing lead-converted requests to populate lead info
UPDATE public.connection_requests cr
SET 
  lead_email = l.email,
  lead_name = l.name,
  lead_company = l.company_name,
  lead_role = l.role
FROM public.inbound_leads l
WHERE cr.source_lead_id = l.id
  AND cr.lead_email IS NULL;

-- Create index for lead email lookups
CREATE INDEX idx_connection_requests_lead_email ON public.connection_requests(lead_email) 
WHERE lead_email IS NOT NULL;