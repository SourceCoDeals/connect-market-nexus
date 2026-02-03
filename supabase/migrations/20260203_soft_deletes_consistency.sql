-- Migration: Implement consistent soft deletes across all tables
-- Adds deleted_at column and ensures RLS policies respect soft deletes

-- =============================================================
-- ADD SOFT DELETE COLUMNS WHERE MISSING
-- =============================================================

-- Listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Remarketing scores table
ALTER TABLE public.remarketing_scores
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Remarketing buyer contacts table
ALTER TABLE public.remarketing_buyer_contacts
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Connection requests table
ALTER TABLE public.connection_requests
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================
-- CREATE SOFT DELETE HELPER FUNCTIONS
-- =============================================================

-- Generic soft delete function
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of deleting, set deleted_at timestamp
  NEW.deleted_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft-deleted records
CREATE OR REPLACE FUNCTION restore_soft_deleted(
  p_table_name TEXT,
  p_record_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1',
    p_table_name
  ) USING p_record_id;

  RETURN FOUND;
END;
$$;

-- =============================================================
-- CREATE VIEWS THAT EXCLUDE SOFT-DELETED RECORDS
-- =============================================================

-- Active listings view (excludes soft-deleted)
CREATE OR REPLACE VIEW public.active_listings AS
SELECT * FROM public.listings
WHERE deleted_at IS NULL;

-- Active buyers view (excludes archived and soft-deleted)
CREATE OR REPLACE VIEW public.active_buyers AS
SELECT * FROM public.remarketing_buyers
WHERE archived = false
  AND (deleted_at IS NULL OR deleted_at IS NULL);

-- Active scores view
CREATE OR REPLACE VIEW public.active_scores AS
SELECT * FROM public.remarketing_scores
WHERE deleted_at IS NULL;

-- Active universes view
CREATE OR REPLACE VIEW public.active_universes AS
SELECT * FROM public.remarketing_buyer_universes
WHERE archived = false;

-- =============================================================
-- UPDATE RLS POLICIES TO RESPECT SOFT DELETES
-- =============================================================

-- Drop and recreate listings select policy
DROP POLICY IF EXISTS "listings_select_policy" ON public.listings;
CREATE POLICY "listings_select_policy" ON public.listings
  FOR SELECT
  USING (deleted_at IS NULL OR auth.jwt() ->> 'is_admin' = 'true');

-- Drop and recreate scores select policy
DROP POLICY IF EXISTS "scores_select_policy" ON public.remarketing_scores;
CREATE POLICY "scores_select_policy" ON public.remarketing_scores
  FOR SELECT
  USING (deleted_at IS NULL OR auth.jwt() ->> 'is_admin' = 'true');

-- =============================================================
-- CREATE INDEXES FOR SOFT DELETE QUERIES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_listings_deleted ON public.listings(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_remarketing_scores_deleted ON public.remarketing_scores(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_remarketing_buyers_deleted ON public.remarketing_buyers(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- =============================================================
-- GRANT ACCESS TO VIEWS
-- =============================================================

GRANT SELECT ON public.active_listings TO authenticated;
GRANT SELECT ON public.active_buyers TO authenticated;
GRANT SELECT ON public.active_scores TO authenticated;
GRANT SELECT ON public.active_universes TO authenticated;

COMMENT ON VIEW public.active_listings IS 'Listings view excluding soft-deleted records';
COMMENT ON VIEW public.active_buyers IS 'Buyers view excluding archived and soft-deleted records';
COMMENT ON COLUMN public.listings.deleted_at IS 'Soft delete timestamp - NULL means active';
