-- Phase 1.1: Fix leaked remarketing deals (any listing without image should NEVER be public)
UPDATE public.listings
SET 
  is_internal_deal = true,
  published_at = NULL,
  published_by_admin_id = NULL
WHERE (image_url IS NULL OR image_url = '')
  AND is_internal_deal = false;

-- Phase 1.3: Add database constraint: no imageless listings can be public
ALTER TABLE public.listings
ADD CONSTRAINT listings_marketplace_requires_image
CHECK (
  is_internal_deal = true 
  OR (is_internal_deal = false AND image_url IS NOT NULL AND image_url != '')
);