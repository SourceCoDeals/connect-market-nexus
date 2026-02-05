-- Phase 1: Fix schema, backfill values, and add publish protection
-- Run in multiple steps to handle edge cases

-- Step 1: Add publishing control columns first
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS published_by_admin_id uuid NULL REFERENCES public.profiles(id);

-- Step 2: Backfill published_at for any existing is_internal_deal=false rows
-- (This prevents constraint violation)
UPDATE public.listings
SET published_at = COALESCE(created_at, NOW())
WHERE is_internal_deal = false AND published_at IS NULL;

-- Step 3: Force is_internal_deal=true for any listing linked to remarketing systems
UPDATE public.listings
SET is_internal_deal = true
WHERE id IN (
  SELECT DISTINCT listing_id FROM public.remarketing_universe_deals WHERE status = 'active'
  UNION
  SELECT DISTINCT listing_id FROM public.remarketing_scores
  UNION  
  SELECT DISTINCT deal_id FROM public.buyer_deal_scores
);

-- Step 4: Restore marketplace visibility for listings with real marketplace engagement
-- that are NOT in remarketing systems
UPDATE public.listings
SET 
  is_internal_deal = false,
  published_at = COALESCE(published_at, created_at, NOW()),
  published_by_admin_id = COALESCE(published_by_admin_id, primary_owner_id)
WHERE id IN (
  SELECT DISTINCT l.id
  FROM public.listings l
  LEFT JOIN public.remarketing_universe_deals rud ON l.id = rud.listing_id AND rud.status = 'active'
  LEFT JOIN public.remarketing_scores rs ON l.id = rs.listing_id
  LEFT JOIN public.buyer_deal_scores bds ON l.id = bds.deal_id
  WHERE 
    l.status = 'active'
    AND l.deleted_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.connection_requests cr WHERE cr.listing_id = l.id)
      OR EXISTS (SELECT 1 FROM public.listing_analytics la WHERE la.listing_id = l.id)
      OR EXISTS (SELECT 1 FROM public.saved_listings sl WHERE sl.listing_id = l.id)
    )
    AND rud.id IS NULL
    AND rs.id IS NULL
    AND bds.id IS NULL
);

-- Step 5: Change is_internal_deal default to false (safe default for admin listing creation)
ALTER TABLE public.listings 
  ALTER COLUMN is_internal_deal SET DEFAULT false;

-- Step 6: Make is_internal_deal NOT NULL
ALTER TABLE public.listings 
  ALTER COLUMN is_internal_deal SET NOT NULL;

-- Step 7: Create constraint to enforce publish requirement for public listings
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_publish_required;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_publish_required 
  CHECK (
    is_internal_deal = true 
    OR (is_internal_deal = false AND published_at IS NOT NULL)
  );

-- Step 8: Create index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_listings_marketplace_visible 
  ON public.listings(status, is_internal_deal, deleted_at, published_at)
  WHERE status = 'active' AND is_internal_deal = false AND deleted_at IS NULL;

-- Step 9: Update the existing triggers to be safer - only mark internal if not already published
CREATE OR REPLACE FUNCTION public.mark_listing_as_internal_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only mark as internal if NOT already published to marketplace
  -- This prevents accidentally hiding a live marketplace listing
  UPDATE public.listings
  SET is_internal_deal = true
  WHERE id = COALESCE(NEW.listing_id, NEW.deal_id)
    AND published_at IS NULL
    AND is_internal_deal = false;
  RETURN NEW;
END;
$$;