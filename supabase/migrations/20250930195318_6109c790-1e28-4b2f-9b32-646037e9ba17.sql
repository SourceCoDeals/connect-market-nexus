-- Fix bidirectional sync: User Management -> Connection Requests & Pipeline
-- When admins update NDA/Fee status from User Management, it should also update connection_requests

-- Drop and recreate update_nda_status to sync to connection_requests
DROP FUNCTION IF EXISTS public.update_nda_status(uuid, boolean, text);

CREATE FUNCTION public.update_nda_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles table
  UPDATE public.profiles
  SET 
    nda_signed = is_signed,
    nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_nda_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true)
  );

  RETURN FOUND;
END;
$$;

-- Drop and recreate update_nda_email_status to sync to connection_requests
DROP FUNCTION IF EXISTS public.update_nda_email_status(uuid, boolean, text);

CREATE FUNCTION public.update_nda_email_status(
  target_user_id uuid,
  is_sent boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles table
  UPDATE public.profiles
  SET 
    nda_email_sent = is_sent,
    nda_email_sent_at = CASE WHEN is_sent THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_nda_email_sent = is_sent,
    lead_nda_email_sent_at = CASE WHEN is_sent THEN NOW() ELSE NULL END,
    lead_nda_email_sent_by = CASE WHEN is_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_sent THEN 'sent' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'email_sent', is_sent)
  );

  RETURN FOUND;
END;
$$;

-- Drop and recreate update_fee_agreement_status to sync to connection_requests
DROP FUNCTION IF EXISTS public.update_fee_agreement_status(uuid, boolean, text);

CREATE FUNCTION public.update_fee_agreement_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles table
  UPDATE public.profiles
  SET 
    fee_agreement_signed = is_signed,
    fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE WHEN is_signed THEN NOW() ELSE NULL END,
    lead_fee_agreement_signed_by = CASE WHEN is_signed THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true)
  );

  RETURN FOUND;
END;
$$;

-- Drop and recreate update_fee_agreement_email_status to sync to connection_requests
DROP FUNCTION IF EXISTS public.update_fee_agreement_email_status(uuid, boolean, text);

CREATE FUNCTION public.update_fee_agreement_email_status(
  target_user_id uuid,
  is_sent boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profiles table
  UPDATE public.profiles
  SET 
    fee_agreement_email_sent = is_sent,
    fee_agreement_email_sent_at = CASE WHEN is_sent THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Sync to ALL connection_requests for this user
  UPDATE public.connection_requests
  SET 
    lead_fee_agreement_email_sent = is_sent,
    lead_fee_agreement_email_sent_at = CASE WHEN is_sent THEN NOW() ELSE NULL END,
    lead_fee_agreement_email_sent_by = CASE WHEN is_sent THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = target_user_id;

  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    CASE WHEN is_sent THEN 'sent' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'email_sent', is_sent)
  );

  RETURN FOUND;
END;
$$;