-- Phase 1: Add fee agreement tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN fee_agreement_signed boolean DEFAULT false,
ADD COLUMN fee_agreement_signed_at timestamp with time zone;

-- Create fee agreement logs table for audit trail
CREATE TABLE public.fee_agreement_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  admin_id uuid,
  action_type text NOT NULL CHECK (action_type IN ('sent', 'signed', 'revoked', 'reminder_sent')),
  email_sent_to text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on fee agreement logs
ALTER TABLE public.fee_agreement_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for fee agreement logs
CREATE POLICY "Admins can view all fee agreement logs" 
ON public.fee_agreement_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert fee agreement logs" 
ON public.fee_agreement_logs 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update fee agreement logs" 
ON public.fee_agreement_logs 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Create function to update fee agreement status
CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(
  target_user_id uuid,
  is_signed boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Create function to log fee agreement email sent
CREATE OR REPLACE FUNCTION public.log_fee_agreement_email(
  target_user_id uuid,
  recipient_email text,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Add updated_at trigger for fee_agreement_logs
CREATE TRIGGER update_fee_agreement_logs_updated_at
BEFORE UPDATE ON public.fee_agreement_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();