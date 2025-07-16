
-- Remove hardcoded admin emails and implement dynamic admin role management

-- First, update the is_admin function to use the profiles table instead of hardcoded emails
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if user has admin role in profiles table
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND is_admin = true
  );
END;
$function$;

-- Update the handle_new_user function to remove hardcoded admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    email_verified,
    approval_status,
    is_admin,
    company,
    website,
    phone_number,
    buyer_type,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email_confirmed_at IS NOT NULL,
    'pending', -- All new users start as pending
    FALSE, -- All new users start as non-admin
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    COALESCE(NEW.raw_user_meta_data->>'website', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'buyer_type', 'corporate'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$;

-- Create a function to safely promote users to admin (only existing admins can do this)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can promote users to admin';
  END IF;
  
  -- Update the target user to admin
  UPDATE public.profiles 
  SET 
    is_admin = true,
    approval_status = 'approved',
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$function$;

-- Create a function to safely demote admins (only existing admins can do this)
CREATE OR REPLACE FUNCTION public.demote_admin_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if the calling user is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can demote admin users';
  END IF;
  
  -- Prevent self-demotion to avoid locking out all admins
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot demote yourself';
  END IF;
  
  -- Update the target user to remove admin privileges
  UPDATE public.profiles 
  SET 
    is_admin = false,
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$function$;

-- Update RLS policies to use the new is_admin function
DROP POLICY IF EXISTS "Admins can view all engagement scores" ON public.engagement_scores;
CREATE POLICY "Admins can view all engagement scores"
ON public.engagement_scores
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Ensure there's at least one admin user (update existing known admin)
-- This is a one-time setup - replace with your actual admin email
UPDATE public.profiles 
SET 
  is_admin = true,
  approval_status = 'approved',
  email_verified = true,
  updated_at = NOW()
WHERE email IN ('ahaile14@gmail.com', 'adambhaile00@gmail.com', 'adam.haile@sourcecodeals.com')
  AND is_admin IS NOT TRUE;
