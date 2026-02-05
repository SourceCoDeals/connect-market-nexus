-- Ensure any listing that becomes part of the remarketing system is automatically hidden from the public marketplace
-- by forcing listings.is_internal_deal = true whenever it is linked to a universe or scored.

CREATE OR REPLACE FUNCTION public.mark_listing_as_internal_deal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Mark the linked listing as internal/research so marketplace queries exclude it
  UPDATE public.listings
  SET is_internal_deal = true,
      updated_at = now()
  WHERE id = NEW.listing_id
    AND coalesce(is_internal_deal, false) = false;

  RETURN NEW;
END;
$$;

-- Trigger for scored deals
DROP TRIGGER IF EXISTS trg_mark_listing_internal_on_score ON public.remarketing_scores;
CREATE TRIGGER trg_mark_listing_internal_on_score
AFTER INSERT ON public.remarketing_scores
FOR EACH ROW
EXECUTE FUNCTION public.mark_listing_as_internal_deal();

-- Trigger for universe-linked deals (even before scoring runs)
DROP TRIGGER IF EXISTS trg_mark_listing_internal_on_universe_deal ON public.remarketing_universe_deals;
CREATE TRIGGER trg_mark_listing_internal_on_universe_deal
AFTER INSERT ON public.remarketing_universe_deals
FOR EACH ROW
EXECUTE FUNCTION public.mark_listing_as_internal_deal();