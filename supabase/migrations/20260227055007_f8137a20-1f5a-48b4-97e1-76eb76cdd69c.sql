-- Add listing_id column to contact_activities for direct deal linkage
ALTER TABLE public.contact_activities ADD COLUMN IF NOT EXISTS listing_id UUID;

-- Index for listing-level call queries
CREATE INDEX IF NOT EXISTS idx_contact_activities_listing_id ON public.contact_activities (listing_id) WHERE listing_id IS NOT NULL;