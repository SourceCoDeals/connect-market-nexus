-- Add new fields for independent sponsors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_deal_size_min NUMERIC,
ADD COLUMN IF NOT EXISTS target_deal_size_max NUMERIC,
ADD COLUMN IF NOT EXISTS geographic_focus JSONB,
ADD COLUMN IF NOT EXISTS industry_expertise JSONB,
ADD COLUMN IF NOT EXISTS deal_structure_preference TEXT;

-- Make critical fields required for better data quality
ALTER TABLE public.profiles 
ALTER COLUMN website SET NOT NULL,
ALTER COLUMN linkedin_profile SET NOT NULL;

-- Add check constraints for data quality
ALTER TABLE public.profiles 
ADD CONSTRAINT check_website_format CHECK (website ~ '^https?://'),
ADD CONSTRAINT check_linkedin_format CHECK (linkedin_profile ~ '^https?://.*linkedin\.com/'),
ADD CONSTRAINT check_ideal_target_description_length CHECK (char_length(ideal_target_description) >= 50),
ADD CONSTRAINT check_deal_size_range CHECK (target_deal_size_min IS NULL OR target_deal_size_max IS NULL OR target_deal_size_min <= target_deal_size_max);