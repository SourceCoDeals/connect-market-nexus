
-- Split sync_connection_request_firm into BEFORE (set firm_id) and AFTER (insert firm_members)
-- The BEFORE trigger was trying to insert into firm_members with NEW.id which doesn't exist yet

-- Drop the existing combined trigger
DROP TRIGGER IF EXISTS sync_connection_request_firm_trigger ON public.connection_requests;

-- Create BEFORE trigger function: only sets firm_id and inherits agreements
CREATE OR REPLACE FUNCTION sync_connection_request_firm_before()
RETURNS TRIGGER AS $$
DECLARE
  v_firm_id UUID;
  v_firm_record RECORD;
  v_email_domain TEXT;
  v_normalized_company TEXT;
  v_generic_domains TEXT[] := ARRAY['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
  v_lead_email TEXT;
  v_lead_name TEXT;
  v_lead_company TEXT;
BEGIN
  IF NEW.firm_id IS NOT NULL THEN
    v_firm_id := NEW.firm_id;
  ELSIF NEW.user_id IS NOT NULL THEN
    v_firm_id := resolve_user_firm_id(NEW.user_id);
    NEW.firm_id := v_firm_id;
  ELSIF NEW.source_lead_id IS NOT NULL THEN
    SELECT firm_id INTO v_firm_id FROM inbound_leads WHERE id = NEW.source_lead_id;
    NEW.firm_id := v_firm_id;
  ELSIF NEW.lead_company IS NOT NULL OR NEW.lead_email IS NOT NULL THEN
    IF NEW.lead_email IS NOT NULL THEN
      v_email_domain := extract_domain(NEW.lead_email);
    END IF;
    IF NEW.lead_company IS NOT NULL THEN
      v_normalized_company := normalize_company_name(NEW.lead_company);
    END IF;
    IF v_normalized_company IS NOT NULL OR (v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains)) THEN
      SELECT id INTO v_firm_id FROM firm_agreements
      WHERE (normalized_company_name = v_normalized_company AND v_normalized_company IS NOT NULL)
         OR (email_domain = v_email_domain AND v_email_domain IS NOT NULL AND v_email_domain <> ALL(v_generic_domains))
      LIMIT 1;
      IF v_firm_id IS NULL THEN
        INSERT INTO firm_agreements (primary_company_name, normalized_company_name, email_domain, member_count, created_at, updated_at)
        VALUES (COALESCE(NEW.lead_company, v_email_domain), COALESCE(v_normalized_company, v_email_domain),
                CASE WHEN v_email_domain <> ALL(v_generic_domains) THEN v_email_domain ELSE NULL END, 0, NOW(), NOW())
        RETURNING id INTO v_firm_id;
      END IF;
      NEW.firm_id := v_firm_id;
    END IF;
  END IF;

  -- Inherit agreement status
  IF NEW.firm_id IS NOT NULL THEN
    SELECT * INTO v_firm_record FROM firm_agreements WHERE id = NEW.firm_id;
    IF v_firm_record.fee_agreement_signed AND NOT COALESCE(NEW.lead_fee_agreement_signed, FALSE) THEN
      NEW.lead_fee_agreement_signed := TRUE;
      NEW.lead_fee_agreement_signed_at := v_firm_record.fee_agreement_signed_at;
    END IF;
    IF v_firm_record.nda_signed AND NOT COALESCE(NEW.lead_nda_signed, FALSE) THEN
      NEW.lead_nda_signed := TRUE;
      NEW.lead_nda_signed_at := v_firm_record.nda_signed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create AFTER trigger function: inserts into firm_members (row exists now, FK is valid)
CREATE OR REPLACE FUNCTION sync_connection_request_firm_after()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_email TEXT;
  v_lead_name TEXT;
  v_lead_company TEXT;
BEGIN
  IF NEW.firm_id IS NOT NULL AND NEW.user_id IS NULL AND COALESCE(NEW.lead_email) IS NOT NULL THEN
    v_lead_email := NEW.lead_email;
    v_lead_name := NEW.lead_name;
    v_lead_company := NEW.lead_company;

    -- If source_lead_id, get from inbound_leads
    IF NEW.source_lead_id IS NOT NULL THEN
      SELECT COALESCE(email, v_lead_email), COALESCE(name, v_lead_name), COALESCE(company_name, v_lead_company)
      INTO v_lead_email, v_lead_name, v_lead_company
      FROM inbound_leads WHERE id = NEW.source_lead_id;
    END IF;

    INSERT INTO firm_members (firm_id, member_type, lead_email, lead_name, lead_company, connection_request_id, inbound_lead_id, added_at)
    VALUES (NEW.firm_id, 'lead', v_lead_email, v_lead_name, v_lead_company, NEW.id, NEW.source_lead_id, NOW())
    ON CONFLICT (firm_id, lead_email) WHERE member_type = 'lead'
    DO UPDATE SET
      connection_request_id = COALESCE(EXCLUDED.connection_request_id, firm_members.connection_request_id),
      inbound_lead_id = COALESCE(EXCLUDED.inbound_lead_id, firm_members.inbound_lead_id),
      lead_name = COALESCE(EXCLUDED.lead_name, firm_members.lead_name),
      lead_company = COALESCE(EXCLUDED.lead_company, firm_members.lead_company),
      updated_at = NOW();

    UPDATE firm_agreements
    SET member_count = (SELECT COUNT(*) FROM firm_members WHERE firm_id = NEW.firm_id), updated_at = NOW()
    WHERE id = NEW.firm_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the two triggers
CREATE TRIGGER sync_connection_request_firm_before_trigger
  BEFORE INSERT OR UPDATE ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION sync_connection_request_firm_before();

CREATE TRIGGER sync_connection_request_firm_after_trigger
  AFTER INSERT ON public.connection_requests
  FOR EACH ROW EXECUTE FUNCTION sync_connection_request_firm_after();

-- Drop the old combined function
DROP FUNCTION IF EXISTS sync_connection_request_firm();
