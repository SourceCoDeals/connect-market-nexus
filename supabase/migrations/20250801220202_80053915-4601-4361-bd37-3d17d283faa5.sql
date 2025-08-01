-- Update log_nda_email function to accept admin_id parameter instead of using auth.uid()
CREATE OR REPLACE FUNCTION public.log_nda_email(
  target_user_id uuid, 
  recipient_email text, 
  admin_id_param uuid,
  admin_notes text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_profile RECORD;
  admin_is_admin boolean;
BEGIN
  -- Check if the provided admin_id is valid and is an admin
  SELECT is_admin INTO admin_is_admin 
  FROM public.profiles 
  WHERE id = admin_id_param;
  
  IF NOT COALESCE(admin_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can log NDA emails';
  END IF;
  
  -- Get admin information
  SELECT email, first_name, last_name 
  INTO admin_profile 
  FROM public.profiles 
  WHERE id = admin_id_param;
  
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
    admin_id_param,
    'sent',
    recipient_email,
    admin_profile.email,
    COALESCE(admin_profile.first_name || ' ' || admin_profile.last_name, admin_profile.email),
    admin_notes,
    jsonb_build_object('email_sent', true, 'sent_at', NOW())
  );
  
  RETURN TRUE;
END;
$function$