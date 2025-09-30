-- Fix activity_type constraint violations in lead status RPCs
-- Replace with allowed types: nda_status_changed, nda_email_sent, fee_agreement_status_changed, fee_agreement_email_sent

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_lead_nda_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_nda_email_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_email_status(uuid, boolean);

-- Recreate with correct activity_type values
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(p_request_id uuid, p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state text;
  v_admin_id uuid;
  v_deal_id uuid;
  v_user_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_state := CASE WHEN p_value THEN 'signed' ELSE 'not_sent' END;

  UPDATE public.connection_requests
  SET 
    lead_nda_signed = p_value,
    lead_nda_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN p_value THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_signed = p_value,
      nda_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  SELECT id INTO v_deal_id FROM public.deals WHERE connection_request_id = p_request_id LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET 
      nda_status = v_state,
      updated_at = NOW()
    WHERE id = v_deal_id;

    INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
    VALUES (
      v_deal_id,
      v_admin_id,
      'nda_status_changed',
      'NDA Status Changed',
      CASE WHEN p_value THEN 'NDA marked as signed' ELSE 'NDA signature revoked' END,
      jsonb_build_object('new_status', v_state, 'previous_status', CASE WHEN p_value THEN 'not_sent' ELSE 'signed' END)
    );
  END IF;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_nda_email_status(p_request_id uuid, p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state text;
  v_admin_id uuid;
  v_deal_id uuid;
  v_user_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_state := CASE WHEN p_value THEN 'sent' ELSE 'not_sent' END;

  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = p_value,
    lead_nda_email_sent_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_nda_email_sent_by = CASE WHEN p_value THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_email_sent = p_value,
      nda_email_sent_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  SELECT id INTO v_deal_id FROM public.deals WHERE connection_request_id = p_request_id LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET 
      nda_status = v_state,
      updated_at = NOW()
    WHERE id = v_deal_id;

    INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
    VALUES (
      v_deal_id,
      v_admin_id,
      'nda_email_sent',
      'NDA Email Status Changed',
      CASE WHEN p_value THEN 'NDA email marked as sent' ELSE 'NDA email status cleared' END,
      jsonb_build_object('email_sent', p_value, 'sent_by_admin', v_admin_id)
    );
  END IF;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(p_request_id uuid, p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state text;
  v_admin_id uuid;
  v_deal_id uuid;
  v_user_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_state := CASE WHEN p_value THEN 'signed' ELSE 'not_sent' END;

  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = p_value,
    lead_fee_agreement_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN p_value THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_signed = p_value,
      fee_agreement_signed_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  SELECT id INTO v_deal_id FROM public.deals WHERE connection_request_id = p_request_id LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET 
      fee_agreement_status = v_state,
      updated_at = NOW()
    WHERE id = v_deal_id;

    INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
    VALUES (
      v_deal_id,
      v_admin_id,
      'fee_agreement_status_changed',
      'Fee Agreement Status Changed',
      CASE WHEN p_value THEN 'Fee Agreement marked as signed' ELSE 'Fee Agreement signature revoked' END,
      jsonb_build_object('new_status', v_state, 'previous_status', CASE WHEN p_value THEN 'not_sent' ELSE 'signed' END)
    );
  END IF;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_email_status(p_request_id uuid, p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state text;
  v_admin_id uuid;
  v_deal_id uuid;
  v_user_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_state := CASE WHEN p_value THEN 'sent' ELSE 'not_sent' END;

  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = p_value,
    lead_fee_agreement_email_sent_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
    lead_fee_agreement_email_sent_by = CASE WHEN p_value THEN v_admin_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_email_sent = p_value,
      fee_agreement_email_sent_at = CASE WHEN p_value THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  SELECT id INTO v_deal_id FROM public.deals WHERE connection_request_id = p_request_id LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
    SET 
      fee_agreement_status = v_state,
      updated_at = NOW()
    WHERE id = v_deal_id;

    INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
    VALUES (
      v_deal_id,
      v_admin_id,
      'fee_agreement_email_sent',
      'Fee Agreement Email Status Changed',
      CASE WHEN p_value THEN 'Fee Agreement email marked as sent' ELSE 'Fee Agreement email status cleared' END,
      jsonb_build_object('email_sent', p_value, 'sent_by_admin', v_admin_id)
    );
  END IF;

  RETURN FOUND;
END;
$$;