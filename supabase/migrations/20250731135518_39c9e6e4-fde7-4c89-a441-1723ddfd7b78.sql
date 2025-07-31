-- Fix 1: Update the constraint to allow all action types used by the functions
ALTER TABLE public.fee_agreement_logs 
DROP CONSTRAINT fee_agreement_logs_action_type_check;

ALTER TABLE public.fee_agreement_logs 
ADD CONSTRAINT fee_agreement_logs_action_type_check 
CHECK (action_type = ANY (ARRAY['sent'::text, 'signed'::text, 'revoked'::text, 'reminder_sent'::text, 'email_marked_sent'::text, 'email_marked_not_sent'::text]));

-- Fix 2: Update the fee agreement functions to use correct action types and improve error handling
CREATE OR REPLACE FUNCTION public.update_fee_agreement_email_status(target_user_id uuid, is_sent boolean, admin_notes text DEFAULT NULL::text)
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
    RAISE EXCEPTION 'Only admins can update fee agreement email status';
  END IF;
  
  -- Update the profile
  UPDATE public.profiles 
  SET 
    fee_agreement_email_sent = is_sent,
    fee_agreement_email_sent_at = CASE 
      WHEN is_sent THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the action with correct action type
  INSERT INTO public.fee_agreement_logs (
    user_id, 
    admin_id, 
    action_type, 
    notes,
    metadata
  ) VALUES (
    target_user_id,
    admin_user_id,
    CASE WHEN is_sent THEN 'sent' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'email_sent', is_sent)
  );
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(target_user_id uuid, is_signed boolean, admin_notes text DEFAULT NULL::text)
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
    RAISE EXCEPTION 'Only admins can update fee agreement status';
  END IF;
  
  -- Update the profile
  UPDATE public.profiles 
  SET 
    fee_agreement_signed = is_signed,
    fee_agreement_signed_at = CASE 
      WHEN is_signed THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the action
  INSERT INTO public.fee_agreement_logs (
    user_id, 
    admin_id, 
    action_type, 
    notes,
    metadata
  ) VALUES (
    target_user_id,
    admin_user_id,
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true)
  );
  
  RETURN FOUND;
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
    RAISE EXCEPTION 'Only admins can log fee agreement emails';
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