-- Backfill missing profiles for auth.users that don't have a profiles row
-- This fixes users like adambhaile00@gmail.com who signed up during the broken period

INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  company,
  buyer_type,
  website,
  linkedin_profile,
  approval_status,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'firstName', 'Unknown'),
  COALESCE(au.raw_user_meta_data->>'last_name', au.raw_user_meta_data->>'lastName', 'User'),
  COALESCE(au.raw_user_meta_data->>'company', ''),
  COALESCE(au.raw_user_meta_data->>'buyer_type', au.raw_user_meta_data->>'buyerType', 'individual'),
  COALESCE(au.raw_user_meta_data->>'website', ''),
  COALESCE(au.raw_user_meta_data->>'linkedin_profile', au.raw_user_meta_data->>'linkedinProfile', ''),
  'pending',
  (au.email_confirmed_at IS NOT NULL),
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Add RLS policy to allow users to INSERT their own profile (for self-healing)
-- This enables the client to create a missing profile if the trigger failed
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);