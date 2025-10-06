
-- Fix NDA and Fee Agreement sync issue between profiles, connection_requests, and deals
-- Root cause: When connection requests are created, they don't inherit NDA/Fee Agreement 
-- status from user's profile, so deals auto-created from them show "not_sent" instead of actual status

-- Create trigger function to sync profile document statuses to connection requests on insert
CREATE OR REPLACE FUNCTION public.sync_profile_documents_to_connection_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Only sync for marketplace requests (those with user_id)
  IF NEW.user_id IS NOT NULL THEN
    -- Get user's profile document statuses
    SELECT 
      nda_signed,
      nda_email_sent,
      nda_signed_at,
      nda_email_sent_at,
      fee_agreement_signed,
      fee_agreement_email_sent,
      fee_agreement_signed_at,
      fee_agreement_email_sent_at
    INTO v_profile
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- If profile found, sync document statuses
    IF FOUND THEN
      NEW.lead_nda_signed := COALESCE(v_profile.nda_signed, false);
      NEW.lead_nda_email_sent := COALESCE(v_profile.nda_email_sent, false);
      NEW.lead_nda_signed_at := v_profile.nda_signed_at;
      NEW.lead_nda_email_sent_at := v_profile.nda_email_sent_at;
      NEW.lead_fee_agreement_signed := COALESCE(v_profile.fee_agreement_signed, false);
      NEW.lead_fee_agreement_email_sent := COALESCE(v_profile.fee_agreement_email_sent, false);
      NEW.lead_fee_agreement_signed_at := v_profile.fee_agreement_signed_at;
      NEW.lead_fee_agreement_email_sent_at := v_profile.fee_agreement_email_sent_at;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger (BEFORE INSERT so it sets values before deal creation trigger)
DROP TRIGGER IF EXISTS trigger_sync_profile_documents ON public.connection_requests;

CREATE TRIGGER trigger_sync_profile_documents
  BEFORE INSERT ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_documents_to_connection_request();

-- Backfill existing connection requests to fix current sync issues
UPDATE public.connection_requests cr
SET 
  lead_nda_signed = COALESCE(p.nda_signed, false),
  lead_nda_email_sent = COALESCE(p.nda_email_sent, false),
  lead_nda_signed_at = p.nda_signed_at,
  lead_nda_email_sent_at = p.nda_email_sent_at,
  lead_fee_agreement_signed = COALESCE(p.fee_agreement_signed, false),
  lead_fee_agreement_email_sent = COALESCE(p.fee_agreement_email_sent, false),
  lead_fee_agreement_signed_at = p.fee_agreement_signed_at,
  lead_fee_agreement_email_sent_at = p.fee_agreement_email_sent_at,
  updated_at = NOW()
FROM public.profiles p
WHERE cr.user_id = p.id
  AND cr.user_id IS NOT NULL
  AND (
    cr.lead_nda_signed != COALESCE(p.nda_signed, false) OR
    cr.lead_fee_agreement_signed != COALESCE(p.fee_agreement_signed, false)
  );

-- Sync deals table to match corrected connection request statuses
UPDATE public.deals d
SET 
  nda_status = CASE 
    WHEN cr.lead_nda_signed THEN 'signed'
    WHEN cr.lead_nda_email_sent THEN 'sent'
    ELSE 'not_sent'
  END,
  fee_agreement_status = CASE 
    WHEN cr.lead_fee_agreement_signed THEN 'signed'
    WHEN cr.lead_fee_agreement_email_sent THEN 'sent'
    ELSE 'not_sent'
  END,
  updated_at = NOW()
FROM public.connection_requests cr
WHERE d.connection_request_id = cr.id
  AND cr.user_id IS NOT NULL
  AND (
    d.nda_status != CASE 
      WHEN cr.lead_nda_signed THEN 'signed'
      WHEN cr.lead_nda_email_sent THEN 'sent'
      ELSE 'not_sent'
    END
    OR
    d.fee_agreement_status != CASE 
      WHEN cr.lead_fee_agreement_signed THEN 'signed'
      WHEN cr.lead_fee_agreement_email_sent THEN 'sent'
      ELSE 'not_sent'
    END
  );

-- Add comment explaining the sync mechanism
COMMENT ON TRIGGER trigger_sync_profile_documents ON public.connection_requests IS 
'Syncs NDA and Fee Agreement statuses from user profile to connection request on creation, ensuring deals inherit correct document statuses';
