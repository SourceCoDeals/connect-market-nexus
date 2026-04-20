
-- Fix update_lead_nda_status: deals → deal_pipeline
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(p_request_id uuid, p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  UPDATE deal_pipeline
  SET 
    nda_status = CASE WHEN p_value THEN 'signed' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = p_request_id;
  
  IF v_firm_id IS NOT NULL THEN
    PERFORM update_nda_firm_status(v_firm_id, p_value, v_signer_id, NULL::text);
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
$function$;

-- Fix update_nda_firm_status (text overload): deals → deal_pipeline
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(p_firm_id uuid, p_is_signed boolean, p_signed_by_user_id uuid DEFAULT NULL::uuid, p_signed_by_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_record RECORD;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update firm NDA status';
  END IF;

  UPDATE public.firm_agreements
  SET
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
    nda_signed_by = p_signed_by_user_id,
    nda_signed_by_name = p_signed_by_name,
    updated_at = NOW()
  WHERE id = p_firm_id;

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

    UPDATE public.connection_requests
    SET
      lead_nda_signed = p_is_signed,
      lead_nda_signed_at = CASE WHEN p_is_signed THEN NOW() ELSE NULL END,
      lead_nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
      updated_at = NOW()
    WHERE user_id = v_member_record.user_id;

    UPDATE public.deal_pipeline
    SET
      nda_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
      updated_at = NOW()
    WHERE connection_request_id IN (
      SELECT id FROM public.connection_requests WHERE user_id = v_member_record.user_id
    );
  END LOOP;

  INSERT INTO public.nda_logs (user_id, admin_id, firm_id, action_type, notes, metadata)
  VALUES (
    COALESCE(p_signed_by_user_id, auth.uid()),
    auth.uid(),
    p_firm_id,
    CASE WHEN p_is_signed THEN 'signed' ELSE 'revoked' END,
    CASE
      WHEN p_is_signed AND p_signed_by_name IS NOT NULL THEN 'NDA marked as signed by ' || p_signed_by_name || ' for entire firm'
      WHEN p_is_signed THEN 'NDA marked as signed for entire firm'
      ELSE 'NDA revoked for entire firm'
    END,
    jsonb_build_object('firm_wide_update', true, 'signed_by_user_id', p_signed_by_user_id, 'signed_by_name', p_signed_by_name)
  );
END;
$function$;

-- Fix update_nda_firm_status (timestamptz overload): deals → deal_pipeline
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(p_firm_id uuid, p_is_signed boolean, p_signed_by_user_id uuid DEFAULT NULL::uuid, p_signed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid;
  caller_is_admin boolean;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = caller_id;
  IF NOT COALESCE(caller_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update firm NDAs';
  END IF;

  UPDATE public.firm_agreements
  SET
    nda_signed = p_is_signed,
    nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;

  UPDATE public.profiles
  SET
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id IN (
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id AND user_id IS NOT NULL
  );

  UPDATE public.connection_requests
  SET
    lead_nda_signed = p_is_signed,
    lead_nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    lead_nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE firm_id = p_firm_id;

  UPDATE public.deal_pipeline
  SET
    nda_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE firm_id = p_firm_id
  );

  RETURN FOUND;
END;
$function$;

-- Fix update_lead_fee_agreement_status: remove hard exception on null firm_id
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(p_request_id uuid, p_value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_firm_id uuid;
  v_signer_id uuid;
BEGIN
  SELECT cr.firm_id, cr.user_id
  INTO v_firm_id, v_signer_id
  FROM connection_requests cr
  WHERE cr.id = p_request_id;

  -- Only update firm if one exists (skip for leads without firms)
  IF v_firm_id IS NOT NULL THEN
    PERFORM update_fee_agreement_firm_status(v_firm_id, p_value, v_signer_id, NULL::text);
  END IF;

  UPDATE deal_pipeline
  SET fee_agreement_status = CASE WHEN p_value THEN 'signed' ELSE 'not_started' END
  WHERE connection_request_id = p_request_id;
END;
$function$;
