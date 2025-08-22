-- Add new fields for independent sponsors
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_deal_size_min NUMERIC,
ADD COLUMN IF NOT EXISTS target_deal_size_max NUMERIC,
ADD COLUMN IF NOT EXISTS geographic_focus JSONB,
ADD COLUMN IF NOT EXISTS industry_expertise JSONB,
ADD COLUMN IF NOT EXISTS deal_structure_preference TEXT;