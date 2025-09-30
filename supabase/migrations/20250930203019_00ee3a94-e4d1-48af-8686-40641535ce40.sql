
-- Phase 1: Add missing RPC functions for NDA and Fee Agreement updates

-- Function to update NDA signed status
CREATE OR REPLACE FUNCTION public.update_nda_status(
  target_user_id UUID,
  is_signed BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get current authenticated user ID
  admin_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Update the profile
  UPDATE public.profiles 
  SET 
    nda_signed = is_signed,
    nda_signed_at = CASE 
      WHEN is_signed THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the action
  INSERT INTO public.nda_logs (
    user_id,
    admin_id,
    action_type,
    notes,
    metadata
  ) VALUES (
    target_user_id,
    admin_user_id,
    CASE WHEN is_signed THEN 'signed' ELSE 'unsigned' END,
    admin_notes,
    jsonb_build_object('signed', is_signed, 'updated_at', NOW())
  );
  
  RETURN FOUND;
END;
$$;

-- Function to update NDA email sent status
CREATE OR REPLACE FUNCTION public.update_nda_email_status(
  target_user_id UUID,
  is_sent BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  admin_user_id := auth.uid();
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  UPDATE public.profiles 
  SET 
    nda_email_sent = is_sent,
    nda_email_sent_at = CASE 
      WHEN is_sent THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to update Fee Agreement signed status
CREATE OR REPLACE FUNCTION public.update_fee_agreement_status(
  target_user_id UUID,
  is_signed BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  admin_user_id := auth.uid();
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
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
    CASE WHEN is_signed THEN 'signed' ELSE 'unsigned' END,
    admin_notes,
    jsonb_build_object('signed', is_signed, 'updated_at', NOW())
  );
  
  RETURN FOUND;
END;
$$;

-- Function to update Fee Agreement email sent status
CREATE OR REPLACE FUNCTION public.update_fee_agreement_email_status(
  target_user_id UUID,
  is_sent BOOLEAN,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  admin_user_id := auth.uid();
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  UPDATE public.profiles 
  SET 
    fee_agreement_email_sent = is_sent,
    fee_agreement_email_sent_at = CASE 
      WHEN is_sent THEN NOW() 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$;

-- Enable realtime for deal_tasks table
ALTER TABLE public.deal_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_tasks;

-- Enable realtime for connection_request_stages table  
ALTER TABLE public.connection_request_stages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_request_stages;
