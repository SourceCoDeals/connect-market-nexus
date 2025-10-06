-- Add visible_to_buyer_types column to listings table
ALTER TABLE public.listings 
ADD COLUMN visible_to_buyer_types TEXT[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.listings.visible_to_buyer_types IS 
'Array of buyer types that can view this listing. NULL or empty array means visible to all buyer types.';

-- Create GIN index for efficient array containment queries
CREATE INDEX idx_listings_visible_buyer_types 
ON public.listings USING GIN (visible_to_buyer_types);

-- Update RLS policy to respect buyer type visibility
-- Drop existing policy if it exists and recreate with buyer type filtering
DROP POLICY IF EXISTS "Approved users can view active listings" ON public.listings;

CREATE POLICY "Approved users can view active listings"
ON public.listings
FOR SELECT
USING (
  status = 'active' 
  AND deleted_at IS NULL
  AND (
    -- Admin users can see everything
    is_admin(auth.uid())
    OR
    -- Regular users see listings based on visibility rules
    (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND approval_status = 'approved' 
        AND email_verified = true
      )
      AND (
        -- Listing is visible to all (NULL or empty array)
        visible_to_buyer_types IS NULL 
        OR array_length(visible_to_buyer_types, 1) IS NULL
        OR
        -- User's buyer_type is in the allowed list
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() 
          AND buyer_type = ANY(visible_to_buyer_types)
        )
      )
    )
  )
);