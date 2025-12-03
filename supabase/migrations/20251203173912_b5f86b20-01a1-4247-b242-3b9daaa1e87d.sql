-- Add new columns to inbound_leads for owner inquiries
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS estimated_revenue_range text;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS sale_timeline text;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS business_website text;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS lead_type text DEFAULT 'buyer';

-- Create index for filtering by lead_type
CREATE INDEX IF NOT EXISTS idx_inbound_leads_lead_type ON inbound_leads(lead_type);

-- Update RLS policy to allow anonymous inserts for owner inquiries (public form)
CREATE POLICY "Allow anonymous owner inquiry submissions" 
ON inbound_leads 
FOR INSERT 
WITH CHECK (source = 'owner_inquiry_form');