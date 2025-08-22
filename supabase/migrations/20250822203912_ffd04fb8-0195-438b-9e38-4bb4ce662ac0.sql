-- First add the Independent Sponsor specific fields without the constraint
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_deal_size_min numeric,
ADD COLUMN IF NOT EXISTS target_deal_size_max numeric,
ADD COLUMN IF NOT EXISTS geographic_focus jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS industry_expertise jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deal_structure_preference text;

-- Make website and linkedin_profile required (NOT NULL) with default empty string for existing records
UPDATE public.profiles SET website = '' WHERE website IS NULL;
UPDATE public.profiles SET linkedin_profile = '' WHERE linkedin_profile IS NULL;

ALTER TABLE public.profiles 
ALTER COLUMN website SET NOT NULL,
ALTER COLUMN linkedin_profile SET NOT NULL;