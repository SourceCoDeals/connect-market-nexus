-- ============================================================================
-- CRITICAL: Add is_internal_deal = false to listings RLS policy
-- ============================================================================
-- The "Approved users can view active listings based on buyer type" policy
-- (from 20251006114111) checks status, deleted_at, and buyer_type but does
-- NOT check is_internal_deal. This means an authenticated buyer can query
-- internal/remarketing deals directly via the Supabase client, bypassing
-- the frontend filter.
--
-- The frontend already filters is_internal_deal = false in use-listings.ts,
-- but RLS must enforce it server-side as defense-in-depth.
-- (Audit Section 4, Issue 2 + Section 8, Issue 3)
-- ============================================================================

-- Drop and recreate the policy with is_internal_deal check
DROP POLICY IF EXISTS "Approved users can view active listings based on buyer type" ON public.listings;

CREATE POLICY "Approved users can view active listings based on buyer type"
ON public.listings
FOR SELECT
TO authenticated
USING (
  -- Admins can see everything (including internal deals)
  is_admin(auth.uid())
  OR
  -- Regular approved users: only marketplace deals, never internal/remarketing
  (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND approval_status = 'approved'
        AND email_verified = true
    )
    AND status = 'active'
    AND deleted_at IS NULL
    AND is_internal_deal = false  -- CRITICAL: prevent non-admin access to internal deals
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

COMMENT ON POLICY "Approved users can view active listings based on buyer type" ON public.listings IS
'Marketplace access control: admins see all listings. Regular users only see active, non-deleted, non-internal listings matching their buyer_type. is_internal_deal=false prevents access to remarketing/research deals.';
