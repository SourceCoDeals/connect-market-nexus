-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Part 2: Auto-link leads trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_link_lead_to_firm()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
  v_firm_id UUID;
  v_email_domain TEXT;
  v_normalized_company TEXT;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
BEGIN
  -- Extract domain from lead email
  IF NEW.email IS NOT NULL THEN
    v_email_domain := extract_domain(NEW.email);
  END IF;

  -- Normalize company name
  IF NEW.company_name IS NOT NULL THEN
    v_normalized_company := normalize_company_name(NEW.company_name);
  END IF;

  -- Try to find existing firm (avoid generic email domains)
  IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) THEN
    SELECT id INTO v_firm_id
    FROM firm_agreements
    WHERE 
      (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
      OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      OR (website_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
    LIMIT 1;
    
    -- If no firm found, create one
    IF v_firm_id IS NULL AND (NEW.company_name IS NOT NULL OR v_email_domain IS NOT NULL) THEN
      INSERT INTO firm_agreements (
        primary_company_name,
        normalized_company_name,
        email_domain,
        member_count,
        created_at,
        updated_at
      ) VALUES (
        COALESCE(NEW.company_name, v_email_domain),
        COALESCE(v_normalized_company, v_email_domain),
        CASE WHEN v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END,
        0,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_firm_id;
    END IF;
    
    NEW.firm_id := v_firm_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS link_lead_to_firm_trigger ON public.inbound_leads;
CREATE TRIGGER link_lead_to_firm_trigger
  BEFORE INSERT OR UPDATE ON public.inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lead_to_firm();