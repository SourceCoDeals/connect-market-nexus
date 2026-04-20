
-- Fix update_lead_fee_agreement_status to also sync connection_requests
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(
  p_request_id uuid,
  p_value boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_deal_id uuid;
BEGIN
  -- Get firm_id and deal_id from connection request
  SELECT firm_id, deal_id INTO v_firm_id, v_deal_id
  FROM connection_requests
  WHERE id = p_request_id;

  -- Update firm_agreements
  IF v_firm_id IS NOT NULL THEN
    UPDATE firm_agreements
    SET fee_agreement_signed = p_value,
        fee_agreement_signed_at = CASE WHEN p_value THEN now() ELSE NULL END,
        fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
        updated_at = now()
    WHERE id = v_firm_id;
  END IF;

  -- Update deal_pipeline
  IF v_deal_id IS NOT NULL THEN
    UPDATE deal_pipeline
    SET fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
        updated_at = now()
    WHERE id = v_deal_id;
  END IF;

  -- Update connection_requests (Bug Fix: this was missing)
  UPDATE connection_requests
  SET lead_fee_agreement_signed = p_value,
      lead_fee_agreement_signed_at = CASE WHEN p_value THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- Fix update_lead_nda_status to also sync connection_requests
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(
  p_request_id uuid,
  p_value boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_deal_id uuid;
BEGIN
  -- Get firm_id and deal_id from connection request
  SELECT firm_id, deal_id INTO v_firm_id, v_deal_id
  FROM connection_requests
  WHERE id = p_request_id;

  -- Update firm_agreements
  IF v_firm_id IS NOT NULL THEN
    UPDATE firm_agreements
    SET nda_signed = p_value,
        nda_signed_at = CASE WHEN p_value THEN now() ELSE NULL END,
        nda_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
        updated_at = now()
    WHERE id = v_firm_id;
  END IF;

  -- Update deal_pipeline
  IF v_deal_id IS NOT NULL THEN
    UPDATE deal_pipeline
    SET nda_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
        updated_at = now()
    WHERE id = v_deal_id;
  END IF;

  -- Update connection_requests (Bug Fix: this was missing)
  UPDATE connection_requests
  SET lead_nda_signed = p_value,
      lead_nda_signed_at = CASE WHEN p_value THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- Backfill Neal Doshi's record: sync connection_requests with firm_agreements
UPDATE connection_requests
SET lead_fee_agreement_signed = true,
    lead_fee_agreement_signed_at = now(),
    updated_at = now()
WHERE lead_email = 'neal@forgedca.com'
  AND lead_fee_agreement_signed = false;
