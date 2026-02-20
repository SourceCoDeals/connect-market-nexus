-- ============================================================================
-- CORRECTIVE MIGRATION: Restore ALL marketplace-ready deals
--
-- PROBLEM: Previous restore migration (20260220000000) was too conservative.
-- It only restored deals that had specific engagement, financial data, or
-- were explicitly pushed. Many legitimate marketplace deals that have images
-- (the key marker of marketplace readiness) were left hidden.
--
-- ROOT CAUSE: The original migration 20260205111804 Step 3 blanket-set
-- is_internal_deal=true for ALL listings linked to remarketing systems.
-- The restore only brought back ~22 deals instead of 60+.
--
-- FIX: If a listing has an image, it was prepared for the marketplace.
-- Internal/research deals never get images. The image IS the signal.
--
-- SAFETY:
--   - Only affects listings with images (constraint already enforces this)
--   - Only affects active, non-deleted listings
--   - Sets published_at to satisfy the listings_publish_required constraint
--   - Preserves all data (no DELETEs, no column drops)
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


-- ─── STEP 2: Harden trigger - never hide a listing that has an image ───
-- The trigger fires when remarketing/scoring operations touch a listing.
-- It should NEVER hide a marketplace-ready deal (one with an image).
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

  -- Only mark as internal if:
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


-- ============================================================================
-- Summary:
--   Restored ALL marketplace-ready deals (active + has image + not deleted).
--   Hardened trigger to never hide deals that have images.
--   Image is the definitive marketplace-readiness signal.
-- ============================================================================
