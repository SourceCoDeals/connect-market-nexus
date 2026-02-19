-- ============================================================================
-- CORRECTIVE MIGRATION: Restore marketplace deals hidden by is_internal_deal
--
-- ROOT CAUSE: Migration 20260205111804 Step 3 force-set is_internal_deal=true
-- for ALL listings in remarketing systems. Step 4 only restored deals that had
-- engagement AND were NOT in remarketing. Marketplace deals that were ALSO in
-- remarketing stayed hidden. The trigger (mark_listing_as_internal_deal) then
-- continued to hide additional deals when scoring/universe operations ran,
-- because many deals lacked published_at.
--
-- THIS MIGRATION:
--   1. Restores marketplace deals that have real buyer engagement
--   2. Restores deals that were explicitly published (have published_at)
--   3. Backfills published_at to protect restored deals from the trigger
--   4. Does NOT touch raw CapTarget imports or internal research deals
--
-- SAFETY:
--   - Only restores deals with clear marketplace evidence
--   - Preserves all data (no DELETEs, no column drops)
--   - Sets published_at to protect from future trigger firings
--   - Fully auditable via published_at timestamp
-- ============================================================================


-- ─── STEP 1: Restore deals that have real buyer engagement ───
-- If real buyers saved, viewed, or requested connection on a deal,
-- it was clearly a marketplace deal and must be visible.
UPDATE public.listings
SET
  is_internal_deal = false,
  published_at = COALESCE(published_at, created_at, NOW())
WHERE is_internal_deal = true
  AND status = 'active'
  AND deleted_at IS NULL
  AND (
    EXISTS (SELECT 1 FROM public.connection_requests cr WHERE cr.listing_id = listings.id)
    OR EXISTS (SELECT 1 FROM public.saved_listings sl WHERE sl.listing_id = listings.id)
    OR EXISTS (SELECT 1 FROM public.listing_analytics la WHERE la.listing_id = listings.id AND la.action_type IN ('view', 'save', 'request_connection'))
  );


-- ─── STEP 2: Restore deals that were explicitly published ───
-- If published_at was set, an admin explicitly published this deal.
-- The trigger should have protected it, but Step 3 of the earlier
-- migration bypassed the trigger.
UPDATE public.listings
SET is_internal_deal = false
WHERE is_internal_deal = true
  AND published_at IS NOT NULL
  AND status = 'active'
  AND deleted_at IS NULL;


-- ─── STEP 3: Restore deals with marketplace characteristics ───
-- Deals with images, real financials, and active status that are NOT
-- raw CapTarget imports or known internal sources.
UPDATE public.listings
SET
  is_internal_deal = false,
  published_at = COALESCE(published_at, created_at, NOW())
WHERE is_internal_deal = true
  AND status = 'active'
  AND deleted_at IS NULL
  AND image_url IS NOT NULL
  AND image_url != ''
  AND revenue > 0
  AND ebitda IS NOT NULL
  AND COALESCE(deal_source, 'manual') NOT IN ('captarget', 'gp_partner', 'valuation_lead');


-- ─── STEP 4: Restore pushed CapTarget deals with marketplace readiness ───
-- CapTarget deals that were explicitly pushed to All Deals AND have
-- marketplace-quality data should also be visible.
UPDATE public.listings
SET
  is_internal_deal = false,
  published_at = COALESCE(published_at, pushed_to_all_deals_at, created_at, NOW())
WHERE is_internal_deal = true
  AND deal_source = 'captarget'
  AND pushed_to_all_deals = true
  AND status = 'active'
  AND deleted_at IS NULL
  AND image_url IS NOT NULL
  AND image_url != ''
  AND revenue > 0;


-- ─── STEP 5: Harden the trigger to also check published_at ───
-- The current trigger already checks published_at IS NULL, but let's
-- make it even safer by also checking for marketplace engagement.
CREATE OR REPLACE FUNCTION public.mark_listing_as_internal_deal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_listing_id uuid;
  has_marketplace_engagement boolean;
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

  -- Only mark as internal if NOT already published AND has no marketplace engagement
  -- This prevents accidentally hiding a live marketplace listing
  IF target_listing_id IS NOT NULL THEN
    -- Check for marketplace engagement before hiding
    SELECT EXISTS (
      SELECT 1 FROM public.connection_requests cr WHERE cr.listing_id = target_listing_id
      UNION ALL
      SELECT 1 FROM public.saved_listings sl WHERE sl.listing_id = target_listing_id
    ) INTO has_marketplace_engagement;

    IF NOT has_marketplace_engagement THEN
      UPDATE public.listings
      SET is_internal_deal = true
      WHERE id = target_listing_id
        AND published_at IS NULL
        AND is_internal_deal = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- Summary:
--   Restored marketplace deals hidden by aggressive is_internal_deal trigger.
--   Protected restored deals with published_at timestamps.
--   Hardened trigger to check for marketplace engagement before hiding.
--   NO data deleted. NO columns dropped. All changes are additive/corrective.
-- ============================================================================
