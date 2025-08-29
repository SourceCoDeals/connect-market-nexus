-- Fix function search path security issues

-- Fix update_deal_stage_timestamp function
CREATE OR REPLACE FUNCTION public.update_deal_stage_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update stage_entered_at when stage changes
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_entered_at = NOW();
    
    -- Log stage change activity
    INSERT INTO public.deal_activities (
      deal_id, admin_id, activity_type, title, description, metadata
    ) VALUES (
      NEW.id,
      auth.uid(),
      'stage_change',
      'Stage changed',
      CASE 
        WHEN OLD.stage_id IS NULL THEN 'Deal created'
        ELSE 'Moved to new stage'
      END,
      jsonb_build_object(
        'previous_stage_id', OLD.stage_id,
        'new_stage_id', NEW.stage_id,
        'changed_at', NOW()
      )
    );
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix create_deal_from_connection_request function
CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
BEGIN
  -- Get default stage
  SELECT id INTO default_stage_id 
  FROM public.deal_stages 
  WHERE is_default = TRUE 
  ORDER BY position 
  LIMIT 1;
  
  -- Get listing title
  SELECT title INTO listing_title
  FROM public.listings
  WHERE id = NEW.listing_id;
  
  -- Create deal title
  deal_title := COALESCE(NEW.lead_name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');
  
  -- Create deal for new connection requests
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    title,
    description,
    source,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    metadata
  ) VALUES (
    NEW.listing_id,
    default_stage_id,
    NEW.id,
    deal_title,
    NEW.user_message,
    COALESCE(NEW.source, 'marketplace'),
    COALESCE(NEW.lead_name, (SELECT first_name || ' ' || last_name FROM public.profiles WHERE id = NEW.user_id)),
    COALESCE(NEW.lead_email, (SELECT email FROM public.profiles WHERE id = NEW.user_id)),
    NEW.lead_company,
    NEW.lead_phone,
    NEW.lead_role,
    jsonb_build_object(
      'auto_created', TRUE,
      'source_type', 'connection_request'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Fix create_deal_from_inbound_lead function
CREATE OR REPLACE FUNCTION public.create_deal_from_inbound_lead()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_stage_id UUID;
  deal_title TEXT;
  listing_title TEXT;
BEGIN
  -- Only create deal when lead is converted
  IF OLD.status != 'converted' AND NEW.status = 'converted' THEN
    -- Get default stage
    SELECT id INTO default_stage_id 
    FROM public.deal_stages 
    WHERE is_default = TRUE 
    ORDER BY position 
    LIMIT 1;
    
    -- Get listing title
    SELECT title INTO listing_title
    FROM public.listings
    WHERE id = NEW.mapped_to_listing_id;
    
    -- Create deal title
    deal_title := COALESCE(NEW.name, 'Unknown') || ' - ' || COALESCE(listing_title, 'Unknown Listing');
    
    -- Create deal for converted lead
    INSERT INTO public.deals (
      listing_id,
      stage_id,
      inbound_lead_id,
      title,
      description,
      source,
      contact_name,
      contact_email,
      contact_company,
      contact_phone,
      contact_role,
      metadata
    ) VALUES (
      NEW.mapped_to_listing_id,
      default_stage_id,
      NEW.id,
      deal_title,
      NEW.message,
      COALESCE(NEW.source, 'webflow'),
      NEW.name,
      NEW.email,
      NEW.company_name,
      NEW.phone_number,
      NEW.role,
      jsonb_build_object(
        'auto_created', TRUE,
        'source_type', 'inbound_lead'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;