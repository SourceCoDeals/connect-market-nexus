-- Critical Security Fixes + Missing Sync Functionality
-- 1. Fix profiles table RLS (remove public access, restrict to admins + own profile)
-- 2. Add RLS policies to inbound_leads (admin-only)
-- 3. Update user-level RPCs to sync to deals table

-- ============================================================================
-- PART 1: Fix profiles table RLS policies
-- ============================================================================

-- Drop any overly permissive SELECT policies on profiles
DROP POLICY IF EXISTS "Anyone can view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Ensure users can only view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles v2" ON public.profiles;
CREATE POLICY "Admins can view all profiles v2"
ON public.profiles 
FOR SELECT 
USING (is_admin(auth.uid()));

-- ============================================================================
-- PART 2: Add RLS policies to inbound_leads table
-- ============================================================================

-- Enable RLS on inbound_leads if not already enabled
ALTER TABLE public.inbound_leads ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
DROP POLICY IF EXISTS "Admins can view all inbound leads" ON public.inbound_leads;
CREATE POLICY "Admins can view all inbound leads" 
ON public.inbound_leads 
FOR SELECT 
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert inbound leads" ON public.inbound_leads;
CREATE POLICY "Admins can insert inbound leads" 
ON public.inbound_leads 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update inbound leads" ON public.inbound_leads;
CREATE POLICY "Admins can update inbound leads" 
ON public.inbound_leads 
FOR UPDATE 
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete inbound leads" ON public.inbound_leads;
CREATE POLICY "Admins can delete inbound leads" 
ON public.inbound_leads 
FOR DELETE 
USING (is_admin(auth.uid()));

-- ============================================================================
-- PART 3: Update user-level RPCs to sync to deals table
-- ============================================================================

-- Update update_nda_status to sync to deals
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

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    nda_status = CASE 
      WHEN is_signed THEN 'signed'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

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

-- Update update_nda_email_status to sync to deals
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

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    nda_status = CASE 
      WHEN is_sent THEN 'sent'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

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

-- Update update_fee_agreement_status to sync to deals
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

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    fee_agreement_status = CASE 
      WHEN is_signed THEN 'signed'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

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

-- Update update_fee_agreement_email_status to sync to deals
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

  -- Sync to ALL deals for this user (via connection_requests)
  UPDATE public.deals
  SET 
    fee_agreement_status = CASE 
      WHEN is_sent THEN 'sent'::text
      ELSE 'not_sent'::text
    END,
    updated_at = NOW()
  WHERE connection_request_id IN (
    SELECT id FROM public.connection_requests WHERE user_id = target_user_id
  );

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