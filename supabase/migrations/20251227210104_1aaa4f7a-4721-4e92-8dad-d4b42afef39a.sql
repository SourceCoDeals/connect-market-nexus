-- Add deal sourcing and acquisition volume fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deal_sourcing_methods text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_acquisition_volume text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.deal_sourcing_methods IS 'How the user typically sources acquisition targets (multi-select)';
COMMENT ON COLUMN public.profiles.target_acquisition_volume IS 'Number of acquisitions targeting in next 12 months';