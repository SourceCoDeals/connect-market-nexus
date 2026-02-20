-- ============================================================================
-- INDEPENDENT DEAL LIFECYCLE: Add remarketing_status to listings
--
-- PURPOSE: Allow remarketing to archive/exclude deals independently from
-- the marketplace. Currently a single `status` column controls both systems,
-- meaning archiving in remarketing also hides from marketplace.
--
-- SAFETY:
--   - ADDITIVE ONLY: Adds one new column. No existing columns dropped/renamed.
--   - NO DATA LOSS: All existing data is preserved. Backfill sets safe default.
--   - FULLY REVERSIBLE: ALTER TABLE DROP COLUMN IF EXISTS remarketing_status
--   - Marketplace pages continue reading `status` (unchanged).
--   - Remarketing pages will read `remarketing_status` instead.
-- ============================================================================

-- 1. Add the remarketing_status column with safe default
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS remarketing_status TEXT DEFAULT 'active';

-- 2. Add CHECK constraint for valid values
-- (Using a separate ALTER to avoid issues if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_remarketing_status_check'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_remarketing_status_check
      CHECK (remarketing_status IN ('active', 'archived', 'excluded', 'completed'));
  END IF;
END $$;

-- 3. Backfill: all existing rows get 'active' (safe default)
UPDATE public.listings
SET remarketing_status = 'active'
WHERE remarketing_status IS NULL;

-- 4. Index for efficient filtering in remarketing pages
CREATE INDEX IF NOT EXISTS idx_listings_remarketing_status
  ON public.listings(remarketing_status);

-- 5. Composite index for remarketing deal queries (status + internal flag + soft delete)
CREATE INDEX IF NOT EXISTS idx_listings_remarketing_active
  ON public.listings(remarketing_status, is_internal_deal)
  WHERE deleted_at IS NULL AND remarketing_status = 'active';
