-- Add new fields to profiles table for enhanced signup step 4
ALTER TABLE public.profiles 
ADD COLUMN deal_intent text,
ADD COLUMN exclusions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN include_keywords jsonb DEFAULT '[]'::jsonb;