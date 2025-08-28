-- Fix security linter: set search_path for function
CREATE OR REPLACE FUNCTION public.update_lead_conversion_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If this connection request is created from a lead, update the lead's conversion tracking
  IF NEW.source_lead_id IS NOT NULL THEN
    UPDATE public.inbound_leads 
    SET 
      converted_to_request_id = NEW.id,
      converted_at = NEW.created_at,
      converted_by = NEW.converted_by,
      status = 'converted'
    WHERE id = NEW.source_lead_id;
  END IF;
  
  RETURN NEW;
END;
$$;