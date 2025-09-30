-- Fix ambiguous 'value' parameter and add cross-platform sync for lead document status RPCs

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_lead_nda_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_nda_email_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_email_status(uuid, boolean);

-- Recreate update_lead_nda_status with fixes
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(request_id uuid, value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state boolean := value;
  v_user_id uuid;
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Auth check
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA status';
  END IF;

  -- Update connection_requests
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = v_state,
    lead_nda_signed_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN v_state THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id
  RETURNING user_id INTO v_user_id;

  -- Sync to profiles
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_signed = v_state,
      nda_signed_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Sync to deals
  UPDATE public.deals
  SET 
    nda_status = CASE WHEN v_state THEN 'signed' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = request_id;

  -- Log activity
  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT 
    d.id, 
    admin_user_id, 
    'document_signed', 
    'Lead NDA Status Updated',
    CASE WHEN v_state THEN 'Lead NDA marked as signed' ELSE 'Lead NDA signature removed' END,
    jsonb_build_object('request_id', request_id, 'nda_signed', v_state, 'timestamp', NOW())
  FROM public.deals d 
  WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Recreate update_lead_nda_email_status with fixes
CREATE OR REPLACE FUNCTION public.update_lead_nda_email_status(request_id uuid, value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state boolean := value;
  v_user_id uuid;
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Auth check
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA email status';
  END IF;

  -- Update connection_requests
  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = v_state,
    lead_nda_email_sent_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id
  RETURNING user_id INTO v_user_id;

  -- Sync to profiles
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_email_sent = v_state,
      nda_email_sent_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Sync to deals
  UPDATE public.deals
  SET 
    nda_status = CASE WHEN v_state THEN 'sent' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = request_id;

  -- Log activity
  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT 
    d.id, 
    admin_user_id, 
    'document_email_sent', 
    'Lead NDA Email Status Updated',
    CASE WHEN v_state THEN 'Lead NDA email marked as sent' ELSE 'Lead NDA email status removed' END,
    jsonb_build_object('request_id', request_id, 'email_sent', v_state, 'timestamp', NOW())
  FROM public.deals d 
  WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Recreate update_lead_fee_agreement_status with fixes
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(request_id uuid, value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state boolean := value;
  v_user_id uuid;
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Auth check
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead Fee Agreement status';
  END IF;

  -- Update connection_requests
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = v_state,
    lead_fee_agreement_signed_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN v_state THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id
  RETURNING user_id INTO v_user_id;

  -- Sync to profiles
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_signed = v_state,
      fee_agreement_signed_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Sync to deals
  UPDATE public.deals
  SET 
    fee_agreement_status = CASE WHEN v_state THEN 'signed' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = request_id;

  -- Log activity
  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT 
    d.id, 
    admin_user_id, 
    'document_signed', 
    'Lead Fee Agreement Status Updated',
    CASE WHEN v_state THEN 'Lead Fee Agreement marked as signed' ELSE 'Lead Fee Agreement signature removed' END,
    jsonb_build_object('request_id', request_id, 'fee_agreement_signed', v_state, 'timestamp', NOW())
  FROM public.deals d 
  WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Recreate update_lead_fee_agreement_email_status with fixes
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_email_status(request_id uuid, value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_state boolean := value;
  v_user_id uuid;
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Auth check
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Admin check
  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead Fee Agreement email status';
  END IF;

  -- Update connection_requests
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = v_state,
    lead_fee_agreement_email_sent_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id
  RETURNING user_id INTO v_user_id;

  -- Sync to profiles
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_email_sent = v_state,
      fee_agreement_email_sent_at = CASE WHEN v_state THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Sync to deals
  UPDATE public.deals
  SET 
    fee_agreement_status = CASE WHEN v_state THEN 'sent' ELSE 'not_sent' END,
    updated_at = NOW()
  WHERE connection_request_id = request_id;

  -- Log activity
  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT 
    d.id, 
    admin_user_id, 
    'document_email_sent', 
    'Lead Fee Agreement Email Status Updated',
    CASE WHEN v_state THEN 'Lead Fee Agreement email marked as sent' ELSE 'Lead Fee Agreement email status removed' END,
    jsonb_build_object('request_id', request_id, 'email_sent', v_state, 'timestamp', NOW())
  FROM public.deals d 
  WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;