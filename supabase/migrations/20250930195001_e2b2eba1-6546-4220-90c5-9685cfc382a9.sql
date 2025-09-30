-- Sync lead document status changes to user profiles table
-- This ensures that NDA/Fee Agreement updates in the pipeline sync to the user's profile

-- Drop and recreate update_lead_nda_status to sync to profiles
DROP FUNCTION IF EXISTS public.update_lead_nda_status(uuid, boolean);

CREATE FUNCTION public.update_lead_nda_status(
  request_id uuid,
  is_signed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from the connection request
  SELECT user_id INTO target_user_id
  FROM public.connection_requests
  WHERE id = request_id;

  -- Update connection_requests table
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  -- Sync to profiles table (user-level status)
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_signed = is_signed,
      nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- Drop and recreate update_lead_nda_email_status to sync to profiles
DROP FUNCTION IF EXISTS public.update_lead_nda_email_status(uuid, boolean);

CREATE FUNCTION public.update_lead_nda_email_status(
  request_id uuid,
  email_sent boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from the connection request
  SELECT user_id INTO target_user_id
  FROM public.connection_requests
  WHERE id = request_id;

  -- Update connection_requests table
  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = email_sent,
    lead_nda_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    lead_nda_email_sent_by = CASE WHEN email_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  -- Sync to profiles table
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      nda_email_sent = email_sent,
      nda_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- Drop and recreate update_lead_fee_agreement_status to sync to profiles
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_status(uuid, boolean);

CREATE FUNCTION public.update_lead_fee_agreement_status(
  request_id uuid,
  is_signed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from the connection request
  SELECT user_id INTO target_user_id
  FROM public.connection_requests
  WHERE id = request_id;

  -- Update connection_requests table
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  -- Sync to profiles table
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_signed = is_signed,
      fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;

-- Drop and recreate update_lead_fee_agreement_email_status to sync to profiles
DROP FUNCTION IF EXISTS public.update_lead_fee_agreement_email_status(uuid, boolean);

CREATE FUNCTION public.update_lead_fee_agreement_email_status(
  request_id uuid,
  email_sent boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user_id from the connection request
  SELECT user_id INTO target_user_id
  FROM public.connection_requests
  WHERE id = request_id;

  -- Update connection_requests table
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = email_sent,
    lead_fee_agreement_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
    lead_fee_agreement_email_sent_by = CASE WHEN email_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = request_id;

  -- Sync to profiles table
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      fee_agreement_email_sent = email_sent,
      fee_agreement_email_sent_at = CASE WHEN email_sent THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = target_user_id;
  END IF;
END;
$$;