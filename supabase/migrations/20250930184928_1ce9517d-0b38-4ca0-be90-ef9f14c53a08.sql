-- Create RPC functions to update connection request document statuses
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(request_id uuid, is_signed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
    RAISE EXCEPTION 'Only admins can update NDA status';
  END IF;

  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_nda_email_status(request_id uuid, email_sent boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
    RAISE EXCEPTION 'Only admins can update NDA email status';
  END IF;

  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_nda_email_sent = email_sent,
    lead_nda_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(request_id uuid, is_signed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
    RAISE EXCEPTION 'Only admins can update fee agreement status';
  END IF;

  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_email_status(request_id uuid, email_sent boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
    RAISE EXCEPTION 'Only admins can update fee agreement email status';
  END IF;

  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_fee_agreement_email_sent = email_sent,
    lead_fee_agreement_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  RETURN FOUND;
END;
$$;