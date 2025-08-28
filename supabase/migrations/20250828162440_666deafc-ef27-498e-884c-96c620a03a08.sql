-- Phase 4: Enhanced Project Management - Source Tracking & Lead-to-Request Linking

-- Add source tracking to connection_requests
ALTER TABLE public.connection_requests 
ADD COLUMN source TEXT DEFAULT 'marketplace',
ADD COLUMN source_lead_id UUID REFERENCES public.inbound_leads(id),
ADD COLUMN source_metadata JSONB DEFAULT '{}',
ADD COLUMN converted_by UUID REFERENCES public.profiles(id),
ADD COLUMN converted_at TIMESTAMP WITH TIME ZONE;

-- Add conversion tracking to inbound_leads  
ALTER TABLE public.inbound_leads
ADD COLUMN converted_by UUID REFERENCES public.profiles(id);

-- Update existing connection_requests to have 'marketplace' source
UPDATE public.connection_requests 
SET source = 'marketplace' 
WHERE source IS NULL;

-- Create index for better performance on source queries
CREATE INDEX idx_connection_requests_source ON public.connection_requests(source);
CREATE INDEX idx_connection_requests_source_lead ON public.connection_requests(source_lead_id);

-- Add constraint to ensure valid source values
ALTER TABLE public.connection_requests
ADD CONSTRAINT check_valid_source 
CHECK (source IN ('marketplace', 'webflow', 'manual', 'import', 'api'));

-- Function to update lead conversion tracking when connection request is created from lead
CREATE OR REPLACE FUNCTION public.update_lead_conversion_tracking()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update lead conversion tracking
CREATE TRIGGER trigger_update_lead_conversion_tracking
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_conversion_tracking();