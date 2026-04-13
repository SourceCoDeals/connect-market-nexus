-- ============================================================================
-- MIGRATION: validate_listing_data fires only on relevant field changes
-- ============================================================================
-- Second root-cause fix for the recurring "Failed to archive deal" error on
-- the remarketing deal pages (GP Partner Deals, SourceCo Deals, CapTarget
-- Deals, Referral Partner Deals, ReMarketing Deals).
--
-- Background
-- ----------
-- Migration 20260714000000_archive_listing_rpc.sql consolidated every archive
-- path onto a single SECURITY DEFINER RPC (archive_listing /
-- archive_listings_bulk). That removed the direct-client-update path and
-- fixed a handful of buggy callers.
--
-- The error kept coming back for deals whose pre-existing data does NOT pass
-- the strict validate_listing_data() trigger. That trigger fires BEFORE
-- INSERT OR UPDATE on listings and validates title length, description
-- length, revenue range, and ebitda/revenue ratio — regardless of which
-- columns the UPDATE touches. SECURITY DEFINER does NOT bypass BEFORE
-- triggers, so even the new RPC path hits this wall:
--
--   UPDATE listings
--   SET remarketing_status = 'archived', archive_reason = $1, updated_at = now()
--   WHERE id = $2;
--
-- fires the validation trigger which then walks NEW.title /
-- NEW.description / NEW.revenue / NEW.ebitda — none of which the archive
-- RPC modifies. Any listing that was imported / enriched with a
-- description < 20 chars, or a title < 5 chars, or a revenue outside the
-- $1K–$1B window (all reachable states for legacy imports, partial
-- enrichments, and short executive summaries) then can never be archived,
-- scored, pushed, or otherwise status-updated. The client sees
-- "Failed to archive deal. Please try again." and the real postgres error
-- is swallowed by the dialog.
--
-- The right fix is for validate_listing_data() to validate each field only
-- when that field is actually changing. Row-level INSERTs still run every
-- check (because OLD is NULL on insert, so OLD.f IS DISTINCT FROM NEW.f is
-- always true for non-null values). UPDATEs only re-validate the fields the
-- caller is touching — archive / soft-delete / remarketing_status flips no
-- longer depend on the validity of unrelated legacy columns.
--
-- The captarget exemption is preserved.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_listing_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- CapTarget-sourced rows skip validation entirely — they're imported
  -- without revenue / ebitda / long descriptions by design.
  IF NEW.deal_source = 'captarget' THEN
    RETURN NEW;
  END IF;

  -- Revenue: between $1K and $1B. Only re-validate when revenue itself
  -- changes (or on INSERT, where OLD is NULL).
  IF TG_OP = 'INSERT' OR NEW.revenue IS DISTINCT FROM OLD.revenue THEN
    IF NEW.revenue IS NOT NULL
       AND (NEW.revenue < 1000 OR NEW.revenue > 1000000000) THEN
      RAISE EXCEPTION 'Revenue must be between $1,000 and $1,000,000,000';
    END IF;
  END IF;

  -- EBITDA / revenue ratio. Re-validate when either side of the ratio
  -- changes, or on INSERT.
  IF TG_OP = 'INSERT'
     OR NEW.revenue IS DISTINCT FROM OLD.revenue
     OR NEW.ebitda  IS DISTINCT FROM OLD.ebitda THEN
    IF NEW.revenue IS NOT NULL
       AND NEW.ebitda IS NOT NULL
       AND NEW.ebitda > NEW.revenue * 2 THEN
      RAISE EXCEPTION 'EBITDA cannot exceed 200%% of revenue';
    END IF;
  END IF;

  -- Title length: 5..200 chars. Only re-validate on actual title change
  -- or on INSERT.
  IF TG_OP = 'INSERT' OR NEW.title IS DISTINCT FROM OLD.title THEN
    IF NEW.title IS NOT NULL
       AND (LENGTH(NEW.title) < 5 OR LENGTH(NEW.title) > 200) THEN
      RAISE EXCEPTION 'Title must be between 5 and 200 characters';
    END IF;
  END IF;

  -- Description length: 20..5000 chars. Only re-validate on actual
  -- description change or on INSERT.
  IF TG_OP = 'INSERT' OR NEW.description IS DISTINCT FROM OLD.description THEN
    IF NEW.description IS NOT NULL
       AND (LENGTH(NEW.description) < 20 OR LENGTH(NEW.description) > 5000) THEN
      RAISE EXCEPTION 'Description must be between 20 and 5000 characters';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_listing_data() IS
  'BEFORE INSERT OR UPDATE trigger on listings. Validates revenue/ebitda/'
  'title/description only for fields that are actually being changed, so '
  'status-only updates (archive, not_a_fit, soft-delete) do not re-validate '
  'unrelated legacy columns. CapTarget-sourced rows are exempted.';
