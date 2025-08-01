-- Remove admin privilege requirements from email logging functions
-- These functions should only require authentication, not admin privileges

CREATE OR REPLACE FUNCTION public.log_nda_email(target_user_id uuid, recipient_email text, admin_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_profile RECORD;
  admin_user_id uuid;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get admin information
  SELECT email, first_name, last_name 
  INTO admin_profile 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  -- Update the profile to mark email as sent
  UPDATE public.profiles 
  SET 
    nda_email_sent = TRUE,
    nda_email_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the email
  INSERT INTO public.nda_logs (
    user_id, 
    admin_id, 
    action_type, 
    email_sent_to,
    admin_email,
    admin_name,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    admin_user_id,
    'sent',
    recipient_email,
    admin_profile.email,
    COALESCE(admin_profile.first_name || ' ' || admin_profile.last_name, admin_profile.email),
    admin_notes,
    jsonb_build_object('email_sent', true, 'sent_at', NOW())
  );
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_fee_agreement_email(target_user_id uuid, recipient_email text, admin_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_profile RECORD;
  admin_user_id uuid;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Get admin information
  SELECT email, first_name, last_name 
  INTO admin_profile 
  FROM public.profiles 
  WHERE id = admin_user_id;
  
  -- Update the profile to mark email as sent
  UPDATE public.profiles 
  SET 
    fee_agreement_email_sent = TRUE,
    fee_agreement_email_sent_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the email
  INSERT INTO public.fee_agreement_logs (
    user_id, 
    admin_id, 
    action_type, 
    email_sent_to,
    admin_email,
    admin_name,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    admin_user_id,
    'sent',
    recipient_email,
    admin_profile.email,
    COALESCE(admin_profile.first_name || ' ' || admin_profile.last_name, admin_profile.email),
    admin_notes,
    jsonb_build_object('email_sent', true, 'sent_at', NOW())
  );
  
  RETURN TRUE;
END;
$function$;