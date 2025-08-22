-- Update null values first before making constraints
UPDATE public.profiles 
SET 
  website = COALESCE(website, 'https://www.company.com'),
  linkedin_profile = COALESCE(linkedin_profile, 'https://linkedin.com/in/placeholder')
WHERE website IS NULL OR linkedin_profile IS NULL;

-- Add new fields for independent sponsors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_deal_size_min NUMERIC,
ADD COLUMN IF NOT EXISTS target_deal_size_max NUMERIC,
ADD COLUMN IF NOT EXISTS geographic_focus JSONB,
ADD COLUMN IF NOT EXISTS industry_expertise JSONB,
ADD COLUMN IF NOT EXISTS deal_structure_preference TEXT;

-- Add check constraints for data quality (without making nullable fields required)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_website_format CHECK (website IS NULL OR website ~ '^https?://'),
ADD CONSTRAINT check_linkedin_format CHECK (linkedin_profile IS NULL OR linkedin_profile ~ '^https?://.*linkedin\.com/'),
ADD CONSTRAINT check_ideal_target_description_length CHECK (ideal_target_description IS NULL OR char_length(ideal_target_description) >= 50),
ADD CONSTRAINT check_deal_size_range CHECK (target_deal_size_min IS NULL OR target_deal_size_max IS NULL OR target_deal_size_min <= target_deal_size_max);