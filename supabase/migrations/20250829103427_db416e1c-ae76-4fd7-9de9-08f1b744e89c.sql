-- Add duplicate tracking to inbound_leads table
ALTER TABLE public.inbound_leads 
ADD COLUMN IF NOT EXISTS duplicate_info TEXT,
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;