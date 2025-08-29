-- Update existing deal stages to match SourceCo workflow
-- First update the stages to remove NDA/Fee Agreement as separate stages since they're status indicators
UPDATE public.deal_stages SET 
  name = 'New Inquiry', 
  description = 'Initial inquiry from potential buyer',
  position = 0,
  color = '#94a3b8'
WHERE name = 'Sourced';

UPDATE public.deal_stages SET 
  name = 'Initial Review', 
  description = 'Admin reviewing buyer credentials and qualification',
  position = 1,
  color = '#f59e0b'
WHERE name = 'Qualified';

-- Keep the qualified stage but move it to position 2
INSERT INTO public.deal_stages (name, description, position, color, is_active, is_default)
VALUES ('Qualified', 'Buyer meets criteria and ready to receive deal information', 2, '#3b82f6', true, false)
ON CONFLICT DO NOTHING;

-- Update NDA Sent to Information Sent
UPDATE public.deal_stages SET 
  name = 'Information Sent', 
  description = 'Deal information has been shared with qualified buyer',
  position = 3,
  color = '#8b5cf6'
WHERE name = 'NDA Sent';

-- Update NDA Signed to Due Diligence
UPDATE public.deal_stages SET 
  name = 'Due Diligence', 
  description = 'Buyer is conducting due diligence on the opportunity',
  position = 4,
  color = '#06b6d4'
WHERE name = 'NDA Signed';

-- Remove Fee Agreement stages as they become status indicators
DELETE FROM public.deal_stages WHERE name IN ('Fee Agreement Sent', 'Fee Agreement Signed');

-- Update Due Diligence position
UPDATE public.deal_stages SET position = 5 WHERE name = 'Due Diligence' AND position = 7;

-- Update remaining stages positions
UPDATE public.deal_stages SET position = 6 WHERE name = 'LOI Submitted' AND position = 8;
UPDATE public.deal_stages SET position = 7 WHERE name = 'Under Contract' AND position = 9;
UPDATE public.deal_stages SET position = 8 WHERE name = 'Closed Won' AND position = 10;
UPDATE public.deal_stages SET position = 9 WHERE name = 'Closed Lost' AND position = 11;