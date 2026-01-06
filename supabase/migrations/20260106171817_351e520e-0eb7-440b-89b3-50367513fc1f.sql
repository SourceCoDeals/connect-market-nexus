
-- CRITICAL FIX: Standardize deal_sourcing_methods to jsonb like other array columns
-- This prevents type mismatch errors and ensures consistency across all array columns

ALTER TABLE public.profiles 
  ALTER COLUMN deal_sourcing_methods TYPE jsonb 
  USING COALESCE(to_jsonb(deal_sourcing_methods), '[]'::jsonb);

-- Also add sensible defaults to NOT NULL columns to prevent insert failures
ALTER TABLE public.profiles 
  ALTER COLUMN first_name SET DEFAULT '',
  ALTER COLUMN last_name SET DEFAULT '',
  ALTER COLUMN website SET DEFAULT '',
  ALTER COLUMN linkedin_profile SET DEFAULT '';

-- Create index on deal_sourcing_methods for query performance
CREATE INDEX IF NOT EXISTS idx_profiles_deal_sourcing_methods ON profiles USING gin(deal_sourcing_methods);
