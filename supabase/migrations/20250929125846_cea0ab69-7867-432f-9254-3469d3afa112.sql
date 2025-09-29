-- Add status field to listings table for sophisticated status tags
ALTER TABLE public.listings 
ADD COLUMN status_tag text DEFAULT NULL;

-- Add comment to document the available status options
COMMENT ON COLUMN public.listings.status_tag IS 'Status tag for listings: just_added, reviewing_buyers, in_diligence, under_loi, accepted_offer';