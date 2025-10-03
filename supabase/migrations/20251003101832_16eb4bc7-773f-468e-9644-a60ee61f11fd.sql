
-- Create the auto-create deal trigger function
CREATE OR REPLACE FUNCTION public.auto_create_deal_from_connection_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_inquiry_stage_id uuid;
  deal_source_value text;
BEGIN
  -- Get New Inquiry stage ID
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  -- Map source correctly (website -> webflow)
  deal_source_value := CASE 
    WHEN NEW.source = 'website' THEN 'webflow'
    WHEN NEW.source IN ('marketplace', 'webflow', 'manual') THEN NEW.source
    ELSE 'marketplace'
  END;

  -- Create deal automatically
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    value,
    probability,
    source,
    title,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    nda_status,
    fee_agreement_status,
    created_at,
    stage_entered_at,
    metadata
  ) VALUES (
    NEW.listing_id,
    new_inquiry_stage_id,
    NEW.id,
    0, -- Default value
    5, -- New Inquiry probability
    deal_source_value,
    COALESCE(
      NEW.lead_name || ' - ' || (SELECT title FROM public.listings WHERE id = NEW.listing_id),
      'New Deal'
    ),
    COALESCE(NEW.lead_name, 'Unknown'),
    NEW.lead_email,
    NEW.lead_company,
    NEW.lead_phone,
    NEW.lead_role,
    CASE 
      WHEN NEW.lead_nda_signed THEN 'signed'
      WHEN NEW.lead_nda_email_sent THEN 'sent' 
      ELSE 'not_sent' 
    END,
    CASE 
      WHEN NEW.lead_fee_agreement_signed THEN 'signed'
      WHEN NEW.lead_fee_agreement_email_sent THEN 'sent' 
      ELSE 'not_sent' 
    END,
    NEW.created_at,
    NEW.created_at,
    jsonb_build_object(
      'auto_created', true,
      'created_from_connection_request', true,
      'original_source', NEW.source
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on connection_requests
DROP TRIGGER IF EXISTS trigger_auto_create_deal_from_request ON public.connection_requests;

CREATE TRIGGER trigger_auto_create_deal_from_request
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_deal_from_connection_request();

-- Verify trigger is created
COMMENT ON TRIGGER trigger_auto_create_deal_from_request ON public.connection_requests IS 
'Automatically creates a deal in New Inquiry stage when a connection request is created';
