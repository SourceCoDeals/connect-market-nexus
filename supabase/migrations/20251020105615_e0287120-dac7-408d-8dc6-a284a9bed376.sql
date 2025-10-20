-- Fix ambiguous column reference in update_fee_agreement_firm_status function
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id uuid,
  p_is_signed boolean,
  p_signed_by_user_id uuid DEFAULT NULL,
  p_signed_by_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_record RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update firm fee agreement status';
  END IF;

  -- Update the firm_agreements table
  UPDATE public.firm_agreements
  SET
    fee_agreement_signed = p_is_signed,
    fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    fee_agreement_signed_by = p_signed_by_user_id,
    fee_agreement_signed_by_name = p_signed_by_name,
    updated_at = NOW()
  WHERE id = p_firm_id;

  -- Update all firm members' profiles
  FOR v_member_record IN
    SELECT fm.user_id
    FROM public.firm_members fm
    WHERE fm.firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET
      fee_agreement_signed = p_is_signed,
      fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;

    -- Update all connection_requests for this user
    UPDATE public.connection_requests
    SET
      lead_fee_agreement_signed = p_is_signed,
      lead_fee_agreement_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_fee_agreement_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;

    -- Update all deals for this user (via connection_requests)
    UPDATE public.deals
    SET
      fee_agreement_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;

  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    firm_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    COALESCE(p_signed_by_user_id, auth.uid()),
    auth.uid(),
    p_firm_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'unsigned' END,
    CASE
      WHEN p_is_signed AND p_signed_by_name IS NOT NULL THEN
        'Fee agreement marked as signed by ' || p_signed_by_name || ' for entire firm'
      WHEN p_is_signed THEN
        'Fee agreement marked as signed for entire firm'
      ELSE
        'Fee agreement marked as unsigned for entire firm'
    END,
    jsonb_build_object(
      'firm_wide_update', true,
      'signed_by_user_id', p_signed_by_user_id,
      'signed_by_name', p_signed_by_name
    )
  );
END;
$$;

-- Fix ambiguous column reference in update_nda_firm_status function
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(
  p_firm_id uuid,
  p_is_signed boolean,
  p_signed_by_user_id uuid DEFAULT NULL,
  p_signed_by_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_record RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update firm NDA status';
  END IF;

  -- Update the firm_agreements table
  UPDATE public.firm_agreements
  SET
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    nda_signed_by = p_signed_by_user_id,
    nda_signed_by_name = p_signed_by_name,
    updated_at = NOW()
  WHERE id = p_firm_id;

  -- Update all firm members' profiles
  FOR v_member_record IN
    SELECT fm.user_id
    FROM public.firm_members fm
    WHERE fm.firm_id = p_firm_id
  LOOP
    UPDATE public.profiles
    SET
      nda_signed = p_is_signed,
      nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_member_record.user_id;

    -- Update all connection_requests for this user
    UPDATE public.connection_requests
    SET
      lead_nda_signed = p_is_signed,
      lead_nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;

    -- Update all deals for this user (via connection_requests)
    UPDATE public.deals
    SET
      nda_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;

  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    firm_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    COALESCE(p_signed_by_user_id, auth.uid()),
    auth.uid(),
    p_firm_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'unsigned' END,
    CASE
      WHEN p_is_signed AND p_signed_by_name IS NOT NULL THEN
        'NDA marked as signed by ' || p_signed_by_name || ' for entire firm'
      WHEN p_is_signed THEN
        'NDA marked as signed for entire firm'
      ELSE
        'NDA marked as unsigned for entire firm'
    END,
    jsonb_build_object(
      'firm_wide_update', true,
      'signed_by_user_id', p_signed_by_user_id,
      'signed_by_name', p_signed_by_name
    )
  );
END;
$$;