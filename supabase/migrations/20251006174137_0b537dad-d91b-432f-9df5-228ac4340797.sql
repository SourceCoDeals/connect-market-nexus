-- Fix connection request deal creation and buyer priority errors
-- 1) Remove duplicate/broken trigger that caused insert failure and potential duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'connection_requests'
      AND t.tgname = 'auto_create_deal_from_connection_request'
  ) THEN
    DROP TRIGGER auto_create_deal_from_connection_request ON public.connection_requests;
  END IF;
END $$;

-- 2) Patch legacy function to stop selecting non-existent columns
CREATE OR REPLACE FUNCTION public.create_deal_from_connection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  IF default_stage_id IS NULL THEN
    RAISE WARNING 'No active deal stage found, cannot create deal for connection request %', NEW.id;
    RETURN NEW;
  END IF;

  -- Determine buyer name/company and priority (do NOT read nonexistent columns)
  IF NEW.user_id IS NOT NULL THEN
    SELECT 
      COALESCE(first_name || ' ' || last_name, email),
      company,                                            -- profiles.company (not company_name)
      COALESCE(public.calculate_buyer_priority_score(buyer_type), 0)  -- compute from buyer_type
    INTO buyer_name, buyer_company, buyer_priority
    FROM public.profiles
    WHERE id = NEW.user_id;
  ELSE
    buyer_name := NEW.lead_name;
    buyer_company := NEW.lead_company;
    buyer_priority := COALESCE(NEW.buyer_priority_score, 0);
  END IF;

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
  ) VALUES (
    NEW.listing_id,
    default_stage_id,
    NEW.id,
    0,
    50,
    NULL,
    CASE 
      WHEN NEW.source = 'marketplace' THEN 'marketplace'
      WHEN NEW.source = 'webflow' THEN 'webflow'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'connection_request'
    END,
    'Connection Request',
    COALESCE(buyer_name, NEW.lead_name, 'Unknown'),
    COALESCE((SELECT email FROM public.profiles WHERE id = NEW.user_id), NEW.lead_email),
    COALESCE(buyer_company, NEW.lead_company),
    NEW.lead_phone,
    NEW.lead_role,
    COALESCE(buyer_priority, 0),
    false,
    jsonb_build_object(
      'connection_request_id', NEW.id,
      'source_type', 'connection_request',
      'created_from_status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$;

-- 3) Safety: ensure BEFORE trigger that sets buyer_priority_score on connection_requests exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'connection_requests'
      AND t.tgname = 'trigger_auto_assign_connection_request_stage'
  ) THEN
    CREATE TRIGGER trigger_auto_assign_connection_request_stage
    BEFORE INSERT OR UPDATE ON public.connection_requests
    FOR EACH ROW EXECUTE FUNCTION public.auto_assign_connection_request_stage();
  END IF;
END $$;