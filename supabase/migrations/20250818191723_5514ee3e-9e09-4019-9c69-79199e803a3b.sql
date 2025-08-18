-- Performance optimization for connection requests admin view
-- Add indexes for frequently queried columns

-- Index for connection_requests ordering by created_at (most frequent ORDER BY)
CREATE INDEX IF NOT EXISTS idx_connection_requests_created_at ON public.connection_requests (created_at DESC);

-- Index for connection_requests user lookups
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_id ON public.connection_requests (user_id);

-- Index for connection_requests listing lookups  
CREATE INDEX IF NOT EXISTS idx_connection_requests_listing_id ON public.connection_requests (listing_id);

-- Index for profiles lookups by id (primary lookup pattern)
CREATE INDEX IF NOT EXISTS idx_profiles_id_lookup ON public.profiles (id) WHERE deleted_at IS NULL;

-- Index for listings lookups by id (primary lookup pattern)
CREATE INDEX IF NOT EXISTS idx_listings_id_lookup ON public.listings (id) WHERE deleted_at IS NULL;

-- Composite index for connection_requests with status filtering
CREATE INDEX IF NOT EXISTS idx_connection_requests_status_created_at ON public.connection_requests (status, created_at DESC);

-- Index for follow-up admin profile lookups (less frequent but still important)
CREATE INDEX IF NOT EXISTS idx_profiles_admin_lookup ON public.profiles (id) WHERE is_admin = true;