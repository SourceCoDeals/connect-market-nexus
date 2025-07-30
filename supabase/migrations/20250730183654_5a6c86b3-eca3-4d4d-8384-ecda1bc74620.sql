-- Fix security warning: Set proper search_path for all functions
CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
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
    auth.uid(),
    CASE WHEN is_signed THEN 'signed' ELSE 'revoked' END,
    admin_notes,
    jsonb_build_object('manual_update', true)
  );
  
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_fee_agreement_email(
  target_user_id uuid,
  recipient_email text,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can log fee agreement emails';
  END IF;
  
  -- Log the email
  INSERT INTO public.fee_agreement_logs (
    user_id, 
    admin_id, 
    action_type, 
    email_sent_to,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    auth.uid(),
    'sent',
    recipient_email,
    admin_notes,
    jsonb_build_object('email_sent', true, 'sent_at', NOW())
  );
  
  RETURN true;
END;
$function$;