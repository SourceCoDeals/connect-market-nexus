-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Part 3: Sync connection request firm trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_connection_request_firm()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
  v_firm_id UUID;
  v_firm_record RECORD;
  v_email_domain TEXT;
  v_normalized_company TEXT;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
BEGIN
  -- Case 1: Connection request from marketplace user (has user_id)
  IF NEW.user_id IS NOT NULL THEN
    SELECT firm_id INTO v_firm_id
    FROM firm_members
    WHERE user_id = NEW.user_id
    LIMIT 1;
    
    NEW.firm_id := v_firm_id;
  
  -- Case 2: Connection request from lead (has source_lead_id)
  ELSIF NEW.source_lead_id IS NOT NULL THEN
    SELECT firm_id INTO v_firm_id
    FROM inbound_leads
    WHERE id = NEW.source_lead_id;
    
    NEW.firm_id := v_firm_id;
  
  -- Case 3: Manual connection request with lead_company and/or lead_email
  ELSIF NEW.lead_company IS NOT NULL OR NEW.lead_email IS NOT NULL THEN
    IF NEW.lead_email IS NOT NULL THEN
      v_email_domain := extract_domain(NEW.lead_email);
    END IF;
    
    IF NEW.lead_company IS NOT NULL THEN
      v_normalized_company := normalize_company_name(NEW.lead_company);
    END IF;
    
    -- Try to find existing firm (avoid generic domains)
    IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) THEN
      SELECT id INTO v_firm_id
      FROM firm_agreements
      WHERE 
        (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
        OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      LIMIT 1;
      
      -- Create firm if not found
      IF v_firm_id IS NULL THEN
        INSERT INTO firm_agreements (
          primary_company_name,
          normalized_company_name,
          email_domain,
          member_count,
          created_at,
          updated_at
        ) VALUES (
          COALESCE(NEW.lead_company, v_email_domain),
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
  END IF;
  
  -- If firm exists, inherit agreement status (use most permissive rule)
  IF v_firm_id IS NOT NULL THEN
    SELECT * INTO v_firm_record
    FROM firm_agreements
    WHERE id = v_firm_id;
    
    -- Fee Agreement: if either firm or request has it signed, keep it signed
    IF v_firm_record.fee_agreement_signed AND NOT COALESCE(NEW.lead_fee_agreement_signed, FALSE) THEN
      NEW.lead_fee_agreement_signed := TRUE;
      NEW.lead_fee_agreement_signed_at := v_firm_record.fee_agreement_signed_at;
      NEW.lead_fee_agreement_signed_by := v_firm_record.fee_agreement_signed_by;
    ELSIF COALESCE(NEW.lead_fee_agreement_signed, FALSE) AND NOT v_firm_record.fee_agreement_signed THEN
      -- Request has signed status but firm doesn't - update firm
      UPDATE firm_agreements
      SET 
        fee_agreement_signed = TRUE,
        fee_agreement_signed_at = COALESCE(NEW.lead_fee_agreement_signed_at, NOW()),
        fee_agreement_signed_by = COALESCE(NEW.lead_fee_agreement_signed_by, auth.uid()),
        updated_at = NOW()
      WHERE id = v_firm_id;
    END IF;
    
    -- NDA: same logic
    IF v_firm_record.nda_signed AND NOT COALESCE(NEW.lead_nda_signed, FALSE) THEN
      NEW.lead_nda_signed := TRUE;
      NEW.lead_nda_signed_at := v_firm_record.nda_signed_at;
      NEW.lead_nda_signed_by := v_firm_record.nda_signed_by;
    ELSIF COALESCE(NEW.lead_nda_signed, FALSE) AND NOT v_firm_record.nda_signed THEN
      UPDATE firm_agreements
      SET 
        nda_signed = TRUE,
        nda_signed_at = COALESCE(NEW.lead_nda_signed_at, NOW()),
        nda_signed_by = COALESCE(NEW.lead_nda_signed_by, auth.uid()),
        updated_at = NOW()
      WHERE id = v_firm_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS sync_connection_request_firm_trigger ON public.connection_requests;
CREATE TRIGGER sync_connection_request_firm_trigger
  BEFORE INSERT OR UPDATE ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_connection_request_firm();