
-- Fix the auto_create_deal_from_connection_request trigger to properly set contact_role
-- Issue: When lead_role is NULL, it sets contact_role to empty string instead of preserving the value

CREATE OR REPLACE FUNCTION public.auto_create_deal_from_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_inquiry_stage_id uuid;
  deal_source_value text;
  contact_name_value text;
  contact_email_value text;
  contact_company_value text;
  contact_phone_value text;
  contact_role_value text;
  buyer_priority_value integer;
BEGIN
  -- Get New Inquiry stage ID
  SELECT id INTO new_inquiry_stage_id
  FROM public.deal_stages
  WHERE name = 'New Inquiry'
  LIMIT 1;

  -- FIXED: Preserve source correctly - don't map website -> webflow
  deal_source_value := CASE 
    WHEN NEW.source IN ('website', 'marketplace', 'webflow', 'manual') THEN NEW.source
    ELSE 'marketplace'
  END;

  -- Get contact data from profiles if user_id exists, otherwise use lead_* fields
  IF NEW.user_id IS NOT NULL THEN
    -- Marketplace user - get data from profiles table
    SELECT 
      COALESCE(p.first_name || ' ' || p.last_name, p.email),
      p.email,
      p.company,
      p.phone_number,
      p.buyer_type,  -- FIXED: Get buyer_type from profile for contact_role
      COALESCE(calculate_buyer_priority_score(p.buyer_type), 0)
    INTO 
      contact_name_value,
      contact_email_value,
      contact_company_value,
      contact_phone_value,
      contact_role_value,
      buyer_priority_value
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  ELSE
    -- Webflow/inbound lead - use lead_* fields
    contact_name_value := NEW.lead_name;
    contact_email_value := NEW.lead_email;
    contact_company_value := NEW.lead_company;
    contact_phone_value := NEW.lead_phone;
    contact_role_value := NEW.lead_role;  -- FIXED: Use lead_role directly
    buyer_priority_value := COALESCE(NEW.buyer_priority_score, 0);
  END IF;

  -- Create deal automatically with proper contact data
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
    buyer_priority_score,
    nda_status,
    fee_agreement_status,
    created_at,
    stage_entered_at,
    metadata
  ) VALUES (
    NEW.listing_id,
    new_inquiry_stage_id,
    NEW.id,
    0,
    5,
    deal_source_value,
    COALESCE(
      contact_name_value || ' - ' || (SELECT title FROM public.listings WHERE id = NEW.listing_id),
      'New Deal'
    ),
    COALESCE(contact_name_value, 'Unknown Contact'),
    contact_email_value,
    contact_company_value,
    contact_phone_value,
    contact_role_value,  -- FIXED: Use the properly set contact_role_value
    buyer_priority_value,
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
      'original_source', NEW.source,
      'source_metadata', NEW.source_metadata,
      'has_user_profile', NEW.user_id IS NOT NULL
    )
  );

  RETURN NEW;
END;
$function$;

-- Update existing deals that have empty contact_role but should have the lead_role value
UPDATE public.deals d
SET contact_role = cr.lead_role
FROM public.connection_requests cr
WHERE d.connection_request_id = cr.id
  AND (d.contact_role IS NULL OR d.contact_role = '')
  AND cr.lead_role IS NOT NULL
  AND cr.lead_role != '';
