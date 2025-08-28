-- Add lead-specific status tracking fields to connection_requests table
ALTER TABLE public.connection_requests 
ADD COLUMN lead_nda_email_sent boolean DEFAULT false,
ADD COLUMN lead_nda_email_sent_at timestamp with time zone,
ADD COLUMN lead_nda_signed boolean DEFAULT false,
ADD COLUMN lead_nda_signed_at timestamp with time zone,
ADD COLUMN lead_fee_agreement_email_sent boolean DEFAULT false,
ADD COLUMN lead_fee_agreement_email_sent_at timestamp with time zone,
ADD COLUMN lead_fee_agreement_signed boolean DEFAULT false,
ADD COLUMN lead_fee_agreement_signed_at timestamp with time zone;

-- Add RPC function to update lead NDA status
CREATE OR REPLACE FUNCTION public.update_lead_nda_status(request_id uuid, is_signed boolean, admin_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if the calling user is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA status';
  END IF;
  
  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_nda_signed = is_signed,
    lead_nda_signed_at = CASE 
      WHEN is_signed THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN FOUND;
END;
$function$;

-- Add RPC function to update lead NDA email status
CREATE OR REPLACE FUNCTION public.update_lead_nda_email_status(request_id uuid, is_sent boolean, admin_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if the calling user is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead NDA email status';
  END IF;
  
  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_nda_email_sent = is_sent,
    lead_nda_email_sent_at = CASE 
      WHEN is_sent THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN FOUND;
END;
$function$;

-- Add RPC function to update lead fee agreement status
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_status(request_id uuid, is_signed boolean, admin_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if the calling user is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead fee agreement status';
  END IF;
  
  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_fee_agreement_signed = is_signed,
    lead_fee_agreement_signed_at = CASE 
      WHEN is_signed THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN FOUND;
END;
$function$;

-- Add RPC function to update lead fee agreement email status
CREATE OR REPLACE FUNCTION public.update_lead_fee_agreement_email_status(request_id uuid, is_sent boolean, admin_notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  admin_is_admin boolean;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Check if the calling user is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can update lead fee agreement email status';
  END IF;
  
  -- Update the connection request
  UPDATE public.connection_requests 
  SET 
    lead_fee_agreement_email_sent = is_sent,
    lead_fee_agreement_email_sent_at = CASE 
      WHEN is_sent THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = request_id;
  
  RETURN FOUND;
END;
$function$;