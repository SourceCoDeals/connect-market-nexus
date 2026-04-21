
-- Drop both overloads of update_fee_agreement_firm_status first
DROP FUNCTION IF EXISTS public.update_fee_agreement_firm_status(uuid, boolean, uuid, text);
DROP FUNCTION IF EXISTS public.update_fee_agreement_firm_status(uuid, boolean, uuid, timestamptz);

-- Drop all overloads of update_lead_fee_agreement_status
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);

-- Recreate update_fee_agreement_firm_status with text (admin_notes) overload
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id uuid,
  p_value boolean,
  p_signer_id uuid DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer_name text;
  v_old_status text;
BEGIN
  IF p_signer_id IS NOT NULL THEN
    SELECT COALESCE(p.first_name || ' ' || p.last_name, p.first_name, 'Unknown')
    INTO v_signer_name
    FROM profiles p
    WHERE p.id = p_signer_id;
  END IF;

  SELECT fee_agreement_status INTO v_old_status
  FROM firm_agreements WHERE id = p_firm_id;

  UPDATE firm_agreements
  SET
    fee_agreement_signed = p_value,
    fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
    fee_agreement_signed_at = CASE WHEN p_value THEN now() ELSE NULL END,
    fee_agreement_signed_by = CASE WHEN p_value THEN p_signer_id ELSE NULL END,
    fee_agreement_signed_by_name = CASE WHEN p_value THEN v_signer_name ELSE NULL END,
    updated_at = now()
  WHERE id = p_firm_id;

  UPDATE deal_pipeline d
  SET fee_agreement_signed = p_value
  FROM connection_requests cr
  WHERE cr.firm_id = p_firm_id
    AND d.connection_request_id = cr.id;

  INSERT INTO agreement_audit_log (firm_id, agreement_type, old_status, new_status, changed_by, changed_by_name, notes)
  VALUES (
    p_firm_id,
    'fee_agreement',
    v_old_status,
    CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
    p_signer_id,
    v_signer_name,
    p_admin_notes
  );
END;
$$;

-- Recreate update_fee_agreement_firm_status with timestamptz overload
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id uuid,
  p_value boolean,
  p_signer_id uuid,
  p_signed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer_name text;
  v_old_status text;
BEGIN
  IF p_signer_id IS NOT NULL THEN
    SELECT COALESCE(p.first_name || ' ' || p.last_name, p.first_name, 'Unknown')
    INTO v_signer_name
    FROM profiles p
    WHERE p.id = p_signer_id;
  END IF;

  SELECT fee_agreement_status INTO v_old_status
  FROM firm_agreements WHERE id = p_firm_id;

  UPDATE firm_agreements
  SET
    fee_agreement_signed = p_value,
    fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
    fee_agreement_signed_at = CASE WHEN p_value THEN COALESCE(p_signed_at, now()) ELSE NULL END,
    fee_agreement_signed_by = CASE WHEN p_value THEN p_signer_id ELSE NULL END,
    fee_agreement_signed_by_name = CASE WHEN p_value THEN v_signer_name ELSE NULL END,
    updated_at = now()
  WHERE id = p_firm_id;

  UPDATE deal_pipeline d
  SET fee_agreement_signed = p_value
  FROM connection_requests cr
  WHERE cr.firm_id = p_firm_id
    AND d.connection_request_id = cr.id;

  INSERT INTO agreement_audit_log (firm_id, agreement_type, old_status, new_status, changed_by, changed_by_name)
  VALUES (
    p_firm_id,
    'fee_agreement',
    v_old_status,
    CASE WHEN p_value THEN 'signed' ELSE 'not_started' END,
    p_signer_id,
    v_signer_name
  );
END;
$$;

-- Recreate update_lead_fee_agreement_status (2-param only)
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
  v_signer_id uuid;
BEGIN
  SELECT cr.firm_id, cr.user_id
  INTO v_firm_id, v_signer_id
  FROM connection_requests cr
  WHERE cr.id = p_request_id;

  IF v_firm_id IS NULL THEN
    RAISE EXCEPTION 'No firm found for connection request %', p_request_id;
  END IF;

  PERFORM update_fee_agreement_firm_status(v_firm_id, p_value, v_signer_id, NULL::text);

  UPDATE deal_pipeline
  SET fee_agreement_signed = p_value
  WHERE connection_request_id = p_request_id;
END;
$$;
