ALTER TABLE public.inbound_leads 
ADD COLUMN IF NOT EXISTS contacted_owner BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.inbound_leads.contacted_owner IS 
  'Tracks whether an admin has gotten in contact with the owner';