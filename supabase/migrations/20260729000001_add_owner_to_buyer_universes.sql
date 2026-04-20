-- ============================================================================
-- Add owner_id to buyer_universes
--
-- Adds an explicit ownership column distinct from created_by. created_by is an
-- immutable audit trail; owner_id is a transferable assignment that determines
-- who is accountable for the universe going forward.
--
-- Existing rows are backfilled from created_by so every universe has an owner.
-- The backward-compatible remarketing_buyer_universes view is recreated so the
-- new column is exposed there as well (SELECT * views freeze their column list
-- at creation time and do not pick up new columns automatically).
-- ============================================================================

ALTER TABLE public.buyer_universes
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.buyer_universes
  SET owner_id = created_by
  WHERE owner_id IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buyer_universes_owner_id
  ON public.buyer_universes(owner_id);

CREATE OR REPLACE VIEW public.remarketing_buyer_universes AS
  SELECT * FROM public.buyer_universes;
