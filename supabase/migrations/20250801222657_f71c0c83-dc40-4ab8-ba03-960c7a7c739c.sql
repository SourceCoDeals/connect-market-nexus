-- Drop all existing NDA log functions to start fresh
DROP FUNCTION IF EXISTS public.log_nda_email(uuid, text, text);
DROP FUNCTION IF EXISTS public.log_nda_email(uuid, text, uuid, text);

-- Create new log_nda_email function matching exact pattern of log_fee_agreement_email
CREATE OR REPLACE FUNCTION public.log_nda_email(target_user_id uuid, recipient_email text, admin_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_profile RECORD;
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
    RAISE EXCEPTION 'Only admins can log NDA emails';
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