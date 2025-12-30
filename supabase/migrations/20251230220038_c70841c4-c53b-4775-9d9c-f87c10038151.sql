-- Create missing profiles for users who signed up when handle_new_user trigger was broken
-- User 1: adambhaile00@gmail.com (b9240bcc-8dcb-40c1-a81a-e7a5c9e9d2c7)
-- User 2: haydaycapitalpartners@gmail.com (699f798b-5832-41e4-a602-1b89b33f8d48)

-- Insert missing profiles with data from auth.users metadata
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  company,
  phone_number,
  buyer_type,
  website,
  linkedin_profile,
  business_categories,
  target_locations,
  investment_size,
  approval_status,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'firstName', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'lastName', ''),
  COALESCE(u.raw_user_meta_data->>'company', ''),
  COALESCE(u.raw_user_meta_data->>'phone_number', u.raw_user_meta_data->>'phoneNumber', ''),
  COALESCE(u.raw_user_meta_data->>'buyer_type', u.raw_user_meta_data->>'buyerType', 'individual'),
  COALESCE(u.raw_user_meta_data->>'website', ''),
  COALESCE(u.raw_user_meta_data->>'linkedin_profile', u.raw_user_meta_data->>'linkedinProfile', ''),
  COALESCE(u.raw_user_meta_data->'business_categories', u.raw_user_meta_data->'businessCategories', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'target_locations', u.raw_user_meta_data->'targetLocations', '[]'::jsonb),
  COALESCE(u.raw_user_meta_data->'investment_size', u.raw_user_meta_data->'investmentSize', '[]'::jsonb),
  'pending',
  (u.email_confirmed_at IS NOT NULL),
  u.created_at,
  NOW()
FROM auth.users u
WHERE u.id IN (
  'b9240bcc-8dcb-40c1-a81a-e7a5c9e9d2c7'::uuid,
  '699f798b-5832-41e4-a602-1b89b33f8d48'::uuid
)
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);