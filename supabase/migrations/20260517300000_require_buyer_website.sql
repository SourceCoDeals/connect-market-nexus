-- ============================================================================
-- REQUIRE BUYER WEBSITE
--
-- A website is the canonical unique identifier for a buyer.
-- Buyers without a website cannot be deduplicated or properly managed.
--
-- This migration:
--   1. Archives all active buyers with no website (or blank website)
--   2. Adds a NOT NULL + non-empty CHECK constraint on company_website
-- ============================================================================

-- ── Step 1: Archive buyers with no website ───────────────────────────────────
UPDATE public.buyers
  SET archived   = true,
      updated_at = now(),
      notes      = COALESCE(notes || E'\n', '') ||
                   '[Archived by 20260517300000: no company_website — website is required]'
  WHERE archived = false
    AND (company_website IS NULL OR trim(company_website) = '');

-- ── Step 2: Verify none remain ───────────────────────────────────────────────
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.buyers
  WHERE archived = false
    AND (company_website IS NULL OR trim(company_website) = '');

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Still % active buyer(s) without a website after archiving', remaining;
  ELSE
    RAISE NOTICE 'Verified: all active buyers have a website.';
  END IF;
END $$;

-- ── Step 3: Add NOT NULL constraint ──────────────────────────────────────────
-- Safe now that all active rows have a value; archived rows may still be NULL
-- but the constraint only needs to block future inserts/updates on active rows.
-- We enforce this with a CHECK rather than NOT NULL so archived legacy rows
-- (which may have NULL websites) don't cause constraint violations.
ALTER TABLE public.buyers
  ADD CONSTRAINT buyers_website_required
  CHECK (
    archived = true
    OR (company_website IS NOT NULL AND trim(company_website) != '')
  );

COMMENT ON CONSTRAINT buyers_website_required ON public.buyers IS
  'Active buyers must have a non-empty company_website. '
  'Archived buyers are exempt to preserve legacy data. '
  'Added 2026-05-17.';
