-- Update Fee Agreement Firm Status RPC to include non-marketplace leads
CREATE OR REPLACE FUNCTION public.update_fee_agreement_firm_status(
  p_firm_id uuid,
  p_is_signed boolean,
  p_signed_by_user_id uuid DEFAULT NULL,
  p_signed_at timestamp with time zone DEFAULT NULL
)
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
    RAISE EXCEPTION 'Only admins can update firm agreements';
  END IF;

  -- Update the firm agreement
  UPDATE public.firm_agreements
  SET
    fee_agreement_signed = p_is_signed,
    fee_agreement_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    fee_agreement_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;

  -- Sync to all firm members (marketplace users)
  UPDATE public.profiles
  SET
    fee_agreement_signed = p_is_signed,
    fee_agreement_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id IN (
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id AND user_id IS NOT NULL
  );

  -- Sync to ALL connection_requests for this firm (includes non-marketplace leads)
  UPDATE public.connection_requests
  SET
    lead_fee_agreement_signed = p_is_signed,
    lead_fee_agreement_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE firm_id = p_firm_id;

  -- Sync to deals linked to this firm's connection_requests
  UPDATE public.deals
  SET
    fee_agreement_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE firm_id = p_firm_id
  );

  RETURN FOUND;
END;
$function$;

-- Update NDA Firm Status RPC to include non-marketplace leads
CREATE OR REPLACE FUNCTION public.update_nda_firm_status(
  p_firm_id uuid,
  p_is_signed boolean,
  p_signed_by_user_id uuid DEFAULT NULL,
  p_signed_at timestamp with time zone DEFAULT NULL
)
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

  -- Update the firm agreement
  UPDATE public.firm_agreements
  SET
    nda_signed = p_is_signed,
    nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_firm_id;

  -- Sync to all firm members (marketplace users)
  UPDATE public.profiles
  SET
    nda_signed = p_is_signed,
    nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    updated_at = NOW()
  WHERE id IN (
    SELECT user_id FROM public.firm_members WHERE firm_id = p_firm_id AND user_id IS NOT NULL
  );

  -- Sync to ALL connection_requests for this firm (includes non-marketplace leads)
  UPDATE public.connection_requests
  SET
    lead_nda_signed = p_is_signed,
    lead_nda_signed_at = CASE WHEN p_is_signed THEN COALESCE(p_signed_at, NOW()) ELSE NULL END,
    lead_nda_signed_by = CASE WHEN p_is_signed THEN p_signed_by_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE firm_id = p_firm_id;

  -- Sync to deals linked to this firm's connection_requests
  UPDATE public.deals
  SET
    nda_status = CASE WHEN p_is_signed THEN 'signed'::text ELSE 'not_sent'::text END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE firm_id = p_firm_id
  );

  RETURN FOUND;
END;
$function$;