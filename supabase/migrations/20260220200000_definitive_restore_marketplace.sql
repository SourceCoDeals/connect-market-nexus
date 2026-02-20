-- ============================================================================
-- DEFINITIVE FIX: Restore all marketplace deals + harden trigger + fix RLS
--
-- ROOT CAUSE SUMMARY:
--   Migration 20260205111804 Step 3 blanket-set is_internal_deal=true for ALL
--   listings linked to remarketing systems, including live marketplace deals.
--   Step 4 only restored deals NOT in remarketing, leaving deals that were
--   in BOTH marketplace AND remarketing permanently hidden.
--   Two prior restore attempts (20260220000000, 20260220100000) were either
--   too conservative or never applied.
--
-- THIS MIGRATION:
--   1. Restores ALL listings that have images (image = marketplace-ready)
--   2. Hardens the trigger to NEVER hide image-bearing listings
--   3. Fixes the permissive RLS policy that bypasses buyer-type checks
--
-- SAFETY:
--   - Only restores listings with images (constraint enforces this anyway)
--   - Only affects active, non-deleted listings
--   - Sets published_at to satisfy listings_publish_required constraint
--   - Preserves all data (no DELETEs, no column drops)
--   - Fully idempotent (safe to run multiple times)
-- ============================================================================


-- ─── STEP 1: Restore ALL active listings that have images ───
-- The image_url is the definitive marker that a deal was prepared for the
-- marketplace. Research/internal deals are data-only and never get images.
-- The listings_marketplace_requires_image constraint already encodes this rule.
UPDATE public.listings
SET
  is_internal_deal = false,
  published_at = COALESCE(published_at, created_at, NOW())
WHERE is_internal_deal = true
  AND status = 'active'
  AND deleted_at IS NULL
  AND image_url IS NOT NULL
  AND image_url != '';


-- ─── STEP 2: Harden trigger — never hide a listing that has an image ───
-- The trigger fires on INSERT into remarketing_scores and
-- remarketing_universe_deals. It should NEVER hide marketplace-ready deals.
CREATE OR REPLACE FUNCTION public.mark_listing_as_internal_deal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_listing_id uuid;
BEGIN
  -- Support multiple trigger sources
  target_listing_id := NEW.listing_id;

  IF target_listing_id IS NULL THEN
    BEGIN
      target_listing_id := NULLIF(to_jsonb(NEW)->>'deal_id', '')::uuid;
    EXCEPTION WHEN others THEN
      target_listing_id := NULL;
    END;
  END IF;

  -- Only mark as internal if ALL of these conditions are true:
  --   1. NOT already published (published_at IS NULL)
  --   2. Has no image (image = marketplace-ready, never hide these)
  --   3. Is not already internal
  IF target_listing_id IS NOT NULL THEN
    UPDATE public.listings
    SET is_internal_deal = true
    WHERE id = target_listing_id
      AND published_at IS NULL
      AND is_internal_deal = false
      AND (image_url IS NULL OR image_url = '');
  END IF;

  RETURN NEW;
END;
$$;


-- ─── STEP 3: Fix permissive RLS policy that bypasses buyer-type checks ───
-- The listings_select_policy from 20260203 allows ANY user to see all
-- non-deleted listings, bypassing the buyer-type visibility policy.
-- Replace it with proper scope: only admins bypass buyer-type checks.
DROP POLICY IF EXISTS "listings_select_policy" ON public.listings;

-- The "Approved users can view active listings based on buyer type" policy
-- (from 20251006114111) already handles all cases:
--   - Admins: see everything
--   - Approved users: see active, non-deleted, buyer-type-matched listings
-- No additional policy needed.


-- ============================================================================
-- Summary:
--   1. Restored ALL marketplace-ready deals (active + has image + not deleted)
--   2. Hardened trigger to never hide deals that have images
--   3. Removed permissive RLS policy that bypassed buyer-type visibility
--   4. Idempotent — safe to run multiple times
-- ============================================================================
