-- ============================================================================
-- Soft-Delete Cascade Trigger
-- ============================================================================
-- When a listing is soft-deleted (deleted_at set to non-NULL), propagate
-- deleted_at to related tables that have a deleted_at column.
-- This prevents orphaned records from inflating dashboard counts and
-- creating stale matches (Audit Section 1, Issue 5).
--
-- Only cascades to tables that HAVE a deleted_at column. Tables without
-- deleted_at are unaffected (they're cleaned up by delete_listing_cascade
-- during hard deletes).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when deleted_at changes from NULL to non-NULL (soft delete)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Cascade to remarketing_scores
    UPDATE public.remarketing_scores
      SET deleted_at = NEW.deleted_at
      WHERE listing_id = NEW.id AND deleted_at IS NULL;

    -- Cascade to remarketing_universe_deals
    UPDATE public.remarketing_universe_deals
      SET deleted_at = NEW.deleted_at
      WHERE listing_id = NEW.id AND deleted_at IS NULL;

    -- Cascade to deals (pipeline entries referencing this listing)
    UPDATE public.deals
      SET deleted_at = NEW.deleted_at
      WHERE listing_id = NEW.id AND deleted_at IS NULL;

    -- Cascade to enrichment_queue
    UPDATE public.enrichment_queue
      SET deleted_at = NEW.deleted_at
      WHERE listing_id = NEW.id AND deleted_at IS NULL;
  END IF;

  -- If restored (deleted_at set back to NULL), restore related records too
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.remarketing_scores
      SET deleted_at = NULL
      WHERE listing_id = NEW.id AND deleted_at = OLD.deleted_at;

    UPDATE public.remarketing_universe_deals
      SET deleted_at = NULL
      WHERE listing_id = NEW.id AND deleted_at = OLD.deleted_at;

    UPDATE public.deals
      SET deleted_at = NULL
      WHERE listing_id = NEW.id AND deleted_at = OLD.deleted_at;

    UPDATE public.enrichment_queue
      SET deleted_at = NULL
      WHERE listing_id = NEW.id AND deleted_at = OLD.deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to listings table
DROP TRIGGER IF EXISTS trg_cascade_soft_delete_listing ON public.listings;
CREATE TRIGGER trg_cascade_soft_delete_listing
  AFTER UPDATE OF deleted_at ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_listing();
