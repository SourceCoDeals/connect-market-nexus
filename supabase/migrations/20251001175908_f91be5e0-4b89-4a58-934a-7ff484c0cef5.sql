-- Ensure deals are created for ALL connection requests immediately (not just approved ones)
-- The existing trigger already does this, but let's verify and add proper logging

-- Update the trigger function to ensure it works for all statuses
CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS TRIGGER AS $$
DECLARE
  default_stage_id UUID;
  buyer_name TEXT;
  buyer_company TEXT;
  buyer_priority INTEGER;
BEGIN
  -- Get default stage (first active stage)
  SELECT id INTO default_stage_id
  FROM public.deal_stages
  WHERE is_active = true
  ORDER BY position ASC
  LIMIT 1;

  -- If no stage found, return without creating deal
  IF default_stage_id IS NULL THEN
    RAISE WARNING 'No active deal stage found, cannot create deal for connection request %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine buyer name and company
  IF NEW.user_id IS NOT NULL THEN
    -- Get from user profile
    SELECT 
      COALESCE(first_name || ' ' || last_name, email),
      company_name,
      buyer_priority_score
    INTO buyer_name, buyer_company, buyer_priority
    FROM public.profiles
    WHERE id = NEW.user_id;
  ELSE
    -- Use lead data
    buyer_name := NEW.lead_name;
    buyer_company := NEW.lead_company;
    buyer_priority := NEW.buyer_priority_score;
  END IF;

  -- Create the deal
  INSERT INTO public.deals (
    listing_id,
    stage_id,
    connection_request_id,
    value,
    probability,
    assigned_to,
    source,
    title,
    contact_name,
    contact_email,
    contact_company,
    contact_phone,
    contact_role,
    buyer_priority_score,
    followed_up,
    metadata
  )
  VALUES (
    NEW.listing_id,
    default_stage_id,
    NEW.id,
    0, -- Value will be set based on listing
    50, -- Default probability
    NULL, -- Can be assigned later
    CASE 
      WHEN NEW.source = 'marketplace' THEN 'marketplace'
      WHEN NEW.source = 'webflow' THEN 'webflow'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'connection_request'
    END,
    'Connection Request', -- Title will be enriched from listing
    COALESCE(buyer_name, NEW.lead_name, 'Unknown'),
    COALESCE((SELECT email FROM public.profiles WHERE id = NEW.user_id), NEW.lead_email),
    COALESCE(buyer_company, NEW.lead_company),
    NEW.lead_phone,
    NEW.lead_role,
    COALESCE(buyer_priority, 0),
    false, -- Default followed_up to false
    jsonb_build_object(
      'connection_request_id', NEW.id,
      'source_type', 'connection_request',
      'created_from_status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it fires on INSERT
DROP TRIGGER IF EXISTS auto_create_deal_from_connection_request ON public.connection_requests;
CREATE TRIGGER auto_create_deal_from_connection_request
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_from_connection_request();

-- Also sync follow-up status from connection_requests to deals when updated
CREATE OR REPLACE FUNCTION public.sync_followup_to_deals()
RETURNS TRIGGER AS $$
BEGIN
  -- When a connection request's follow-up status changes, update all related deals
  IF (OLD.followed_up IS DISTINCT FROM NEW.followed_up) 
     OR (OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at)
     OR (OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by) THEN
    
    UPDATE public.deals
    SET 
      followed_up = NEW.followed_up,
      followed_up_at = NEW.followed_up_at,
      followed_up_by = NEW.followed_up_by,
      updated_at = NOW()
    WHERE connection_request_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for syncing follow-up status
DROP TRIGGER IF EXISTS sync_followup_to_deals ON public.connection_requests;
CREATE TRIGGER sync_followup_to_deals
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  WHEN (OLD.followed_up IS DISTINCT FROM NEW.followed_up 
        OR OLD.followed_up_at IS DISTINCT FROM NEW.followed_up_at
        OR OLD.followed_up_by IS DISTINCT FROM NEW.followed_up_by)
  EXECUTE FUNCTION public.sync_followup_to_deals();