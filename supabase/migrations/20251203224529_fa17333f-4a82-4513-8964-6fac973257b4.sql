-- Create admin_owner_leads_views table for per-admin tracking
CREATE TABLE public.admin_owner_leads_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL UNIQUE,
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_owner_leads_views ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage their own records
CREATE POLICY "Admins can manage their own owner leads view tracking"
ON public.admin_owner_leads_views
FOR ALL
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Add admin_notes column to inbound_leads table for lead notes
ALTER TABLE public.inbound_leads 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE admin_owner_leads_views;