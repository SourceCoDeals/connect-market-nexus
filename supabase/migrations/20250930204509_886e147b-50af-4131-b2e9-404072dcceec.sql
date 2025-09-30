-- Phase 1: Drop and recreate lead status RPC functions with proper signatures

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_lead_nda_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_nda_email_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_email_status(uuid, boolean);

-- Create function to update lead NDA signed status
CREATE FUNCTION public.update_lead_nda_status(
  request_id uuid,
  value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA status';
  END IF;

  UPDATE public.connection_requests
  SET 
    lead_nda_signed = value,
    lead_nda_signed_at = CASE WHEN value THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN value THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT d.id, admin_user_id, 'document_update', 'Lead NDA Status Updated',
    CASE WHEN value THEN 'Lead NDA marked as signed' ELSE 'Lead NDA signature removed' END,
    jsonb_build_object('request_id', request_id, 'nda_signed', value, 'timestamp', NOW())
  FROM public.deals d WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Create function to update lead NDA email status
CREATE FUNCTION public.update_lead_nda_email_status(
  request_id uuid,
  value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA email status';
  END IF;

  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = value,
    lead_nda_email_sent_at = CASE WHEN value THEN NOW() ELSE NULL END,
    lead_nda_email_sent_by = CASE WHEN value THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT d.id, admin_user_id, 'document_update', 'Lead NDA Email Status Updated',
    CASE WHEN value THEN 'Lead NDA email marked as sent' ELSE 'Lead NDA email status cleared' END,
    jsonb_build_object('request_id', request_id, 'email_sent', value, 'timestamp', NOW())
  FROM public.deals d WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Create function to update lead fee agreement signed status
CREATE FUNCTION public.update_lead_fee_agreement_status(
  request_id uuid,
  value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead fee agreement status';
  END IF;

  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = value,
    lead_fee_agreement_signed_at = CASE WHEN value THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN value THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT d.id, admin_user_id, 'document_update', 'Lead Fee Agreement Status Updated',
    CASE WHEN value THEN 'Lead fee agreement marked as signed' ELSE 'Lead fee agreement signature removed' END,
    jsonb_build_object('request_id', request_id, 'fee_agreement_signed', value, 'timestamp', NOW())
  FROM public.deals d WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;

-- Create function to update lead fee agreement email status
CREATE FUNCTION public.update_lead_fee_agreement_email_status(
  request_id uuid,
  value boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  admin_user_id := auth.uid();
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT is_admin INTO admin_is_admin FROM public.profiles WHERE id = admin_user_id;
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead fee agreement email status';
  END IF;

  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = value,
    lead_fee_agreement_email_sent_at = CASE WHEN value THEN NOW() ELSE NULL END,
    lead_fee_agreement_email_sent_by = CASE WHEN value THEN admin_user_id ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  INSERT INTO public.deal_activities (deal_id, admin_id, activity_type, title, description, metadata)
  SELECT d.id, admin_user_id, 'document_update', 'Lead Fee Agreement Email Status Updated',
    CASE WHEN value THEN 'Lead fee agreement email marked as sent' ELSE 'Lead fee agreement email status cleared' END,
    jsonb_build_object('request_id', request_id, 'email_sent', value, 'timestamp', NOW())
  FROM public.deals d WHERE d.connection_request_id = request_id;

  RETURN TRUE;
END;
$$;