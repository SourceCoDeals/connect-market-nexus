-- First fix the unique constraint issue by checking existing data
-- Insert deal stages only if they don't exist
INSERT INTO public.deal_stages (name, description, position, color, is_active, is_default) 
SELECT * FROM (VALUES 
  ('New Inquiry', 'Initial inquiry from potential buyer', 0, '#94a3b8', true, true),
  ('Initial Review', 'Admin reviewing buyer credentials and qualification', 1, '#f59e0b', true, false),
  ('Qualified', 'Buyer meets criteria and ready to receive deal information', 2, '#3b82f6', true, false),
  ('Information Sent', 'Deal information has been shared with qualified buyer', 3, '#8b5cf6', true, false),
  ('Due Diligence', 'Buyer is conducting due diligence on the opportunity', 4, '#06b6d4', true, false),
  ('LOI Submitted', 'Letter of Intent has been submitted by buyer', 5, '#f97316', true, false),
  ('Under Contract', 'Deal is under contract and progressing to close', 6, '#10b981', true, false),
  ('Closed Won', 'Deal successfully closed', 7, '#22c55e', true, false),
  ('Closed Lost', 'Deal did not proceed to completion', 8, '#ef4444', true, false)
) AS new_stages(name, description, position, color, is_active, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stages 
  WHERE deal_stages.name = new_stages.name
);