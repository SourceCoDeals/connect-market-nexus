-- ============================================================================
-- AUTO-CREATE FIRM_MEMBER ENTRIES FOR INBOUND LEADS
-- ============================================================================
-- This trigger automatically creates a firm_member entry when an inbound lead 
-- with a firm_id is created or updated, ensuring leads appear in firm membership

CREATE OR REPLACE FUNCTION public.auto_create_firm_member_for_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if firm_id and email exist
  IF NEW.firm_id IS NOT NULL AND NEW.email IS NOT NULL THEN
    -- Insert or update firm_member entry for this lead
    INSERT INTO public.firm_members (
      firm_id,
      member_type,
      lead_email,
      lead_name,
      lead_company,
      inbound_lead_id,
      added_at
    )
    VALUES (
      NEW.firm_id,
      'lead',
      NEW.email,
      NEW.name,
      NEW.company_name,
      NEW.id,
      NOW()
    )
    ON CONFLICT (firm_id, lead_email) 
    WHERE member_type = 'lead'
    DO UPDATE SET
      lead_name = EXCLUDED.lead_name,
      lead_company = EXCLUDED.lead_company,
      inbound_lead_id = EXCLUDED.inbound_lead_id,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for inbound_leads
DROP TRIGGER IF EXISTS auto_create_firm_member_for_lead_trigger ON public.inbound_leads;
CREATE TRIGGER auto_create_firm_member_for_lead_trigger
  AFTER INSERT OR UPDATE OF firm_id, email, name, company_name ON public.inbound_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_firm_member_for_lead();