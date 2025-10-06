-- First, drop the old policy if it exists
DROP POLICY IF EXISTS "Approved users can view active listings" ON public.listings;

-- Create the new RLS policy with buyer type visibility filtering
CREATE POLICY "Approved users can view active listings based on buyer type"
ON public.listings
FOR SELECT
TO authenticated
USING (
  -- Admins can see everything
  is_admin(auth.uid())
  OR
  -- Regular approved users with verified email can see listings based on visibility rules
  (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND approval_status = 'approved'
        AND email_verified = true
    )
    AND status = 'active'
    AND deleted_at IS NULL
    AND (
      -- Listing is visible to all (NULL or empty array)
      visible_to_buyer_types IS NULL
      OR array_length(visible_to_buyer_types, 1) IS NULL
      OR
      -- OR user's buyer_type is in the allowed list
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND buyer_type = ANY(listings.visible_to_buyer_types)
      )
    )
  )
);

-- Add helpful comment
COMMENT ON POLICY "Approved users can view active listings based on buyer type" ON public.listings IS 
'Filters listings based on buyer type visibility. Admins see all. Regular users only see listings where visible_to_buyer_types is NULL/empty OR contains their buyer_type.';