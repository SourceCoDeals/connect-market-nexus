-- ============================================================================
-- Landing Page: Allow anonymous read of published listings and anonymous
-- insert into connection_requests for the public deal landing pages.
-- ============================================================================
--
-- The /deals/:id landing pages are fully public (no login required).
-- Two RLS changes are needed:
--
-- 1. LISTINGS: Allow anon role to SELECT published, non-internal deals.
--    This is scoped to only active, non-deleted, non-internal listings.
--
-- 2. CONNECTION_REQUESTS: Allow anon role to INSERT rows where user_id IS
--    NULL and source = 'landing_page'. This lets the landing page form
--    submit lead info without authentication.
-- ============================================================================

BEGIN;

-- 1. Allow anonymous users to read published marketplace listings
DROP POLICY IF EXISTS "Anonymous users can view published listings" ON public.listings;
CREATE POLICY "Anonymous users can view published listings"
ON public.listings
FOR SELECT
TO anon
USING (
  status = 'active'
  AND deleted_at IS NULL
  AND is_internal_deal = false
);

COMMENT ON POLICY "Anonymous users can view published listings" ON public.listings IS
'Allows unauthenticated visitors to view published marketplace listings on deal landing pages. Only active, non-deleted, non-internal deals are visible.';

-- 2. Allow anonymous users to submit landing page lead forms
DROP POLICY IF EXISTS "Anonymous users can submit landing page leads" ON public.connection_requests;
CREATE POLICY "Anonymous users can submit landing page leads"
ON public.connection_requests
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND source = 'landing_page'
);

COMMENT ON POLICY "Anonymous users can submit landing page leads" ON public.connection_requests IS
'Allows unauthenticated visitors to submit the Request Full Deal Details form on public landing pages. Scoped to rows with no user_id and source=landing_page.';

COMMIT;
