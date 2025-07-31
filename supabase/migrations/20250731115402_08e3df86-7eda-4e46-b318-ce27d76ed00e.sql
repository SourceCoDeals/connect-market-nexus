-- Phase 1: Database Schema Updates for Fee Agreement System

-- Add fee agreement email sent tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN fee_agreement_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN fee_agreement_email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update fee_agreement_logs table to include admin information
ALTER TABLE public.fee_agreement_logs 
ADD COLUMN admin_email TEXT,
ADD COLUMN admin_name TEXT;

-- Create function to update fee agreement email sent status
CREATE OR REPLACE FUNCTION public.update_fee_agreement_email_status(
  target_user_id UUID,
  is_sent BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
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
    CASE WHEN is_sent THEN 'email_marked_sent' ELSE 'email_marked_not_sent' END,
    admin_notes,
    jsonb_build_object('manual_update', true, 'email_sent', is_sent)
  );
  
  RETURN FOUND;
END;
$$;

-- Update the existing log_fee_agreement_email function to include admin info
CREATE OR REPLACE FUNCTION public.log_fee_agreement_email(
  target_user_id UUID, 
  recipient_email TEXT, 
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_profile RECORD;
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can log fee agreement emails';
  END IF;
  
  -- Get admin information
  SELECT email, first_name, last_name 
  INTO admin_profile 
  FROM public.profiles 
  WHERE id = auth.uid();
  
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
    auth.uid(),
    'sent',
    recipient_email,
    admin_profile.email,
    COALESCE(admin_profile.first_name || ' ' || admin_profile.last_name, admin_profile.email),
    admin_notes,
    jsonb_build_object('email_sent', true, 'sent_at', NOW())
  );
  
  RETURN TRUE;
END;
$$;