-- Add project_name column to listings table.
-- This is the anonymous codename used in buyer-facing teasers (e.g. "Project Restoration").
-- It must be populated before an Anonymous Teaser can be generated.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS project_name TEXT;

COMMENT ON COLUMN public.listings.project_name IS 'Anonymous project codename for buyer-facing documents (e.g. Project Restoration)';
