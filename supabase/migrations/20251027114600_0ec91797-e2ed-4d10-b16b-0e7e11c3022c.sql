-- ============================================================================
-- FIRM AGREEMENTS EXTENSION - Part 4 (Fixed): Update RPC functions
-- ============================================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_lead_nda_status(UUID, BOOLEAN);

-- Recreate with cascading logic
CREATE FUNCTION public.update_lead_fee_agreement_status(
  p_request_id UUID,
  p_value BOOLEAN
)
RETURNS VOID
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
  v_firm_id UUID;
  v_user_id UUID;
  v_signer_id UUID;
BEGIN
  v_signer_id := auth.uid();
  
  SELECT firm_id, user_id INTO v_firm_id, v_user_id
  FROM connection_requests
  WHERE id = p_request_id;
  
  UPDATE connection_requests
  SET 
    lead_fee_agreement_signed = p_value,
    lead_fee_agreement_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN p_value THEN v_signer_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  UPDATE deals
  SET 
    fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = p_request_id;
  
  IF v_firm_id IS NOT NULL THEN
    PERFORM update_fee_agreement_firm_status(v_firm_id, p_value, v_signer_id, NULL);
  ELSIF v_user_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      fee_agreement_signed = p_value,
      fee_agreement_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      fee_agreement_signed_by = CASE WHEN p_value THEN v_signer_id ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;
END;
$$;

CREATE FUNCTION public.update_lead_nda_status(
  p_request_id UUID,
  p_value BOOLEAN
)
RETURNS VOID
SECURITY DEFINER
SET search_path = 'public'
LANGUAGE plpgsql
AS $$
DECLARE
  v_firm_id UUID;
  v_user_id UUID;
  v_signer_id UUID;
BEGIN
  v_signer_id := auth.uid();
  
  SELECT firm_id, user_id INTO v_firm_id, v_user_id
  FROM connection_requests
  WHERE id = p_request_id;
  
  UPDATE connection_requests
  SET 
    lead_nda_signed = p_value,
    lead_nda_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN p_value THEN v_signer_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  UPDATE deals
  SET 
    nda_status = CASE WHEN p_value THEN 'signed' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = p_request_id;
  
  IF v_firm_id IS NOT NULL THEN
    PERFORM update_nda_firm_status(v_firm_id, p_value, v_signer_id, NULL);
  ELSIF v_user_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      nda_signed = p_value,
      nda_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      nda_signed_by = CASE WHEN p_value THEN v_signer_id ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;
END;
$$;