CREATE OR REPLACE FUNCTION public.mark_listing_as_internal_deal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_listing_id uuid;
BEGIN
  -- Support multiple trigger sources without assuming column presence.
  -- Some tables have listing_id; some legacy tables may have deal_id.
  target_listing_id := NEW.listing_id;

  IF target_listing_id IS NULL THEN
    BEGIN
      target_listing_id := NULLIF(to_jsonb(NEW)->>'deal_id', '')::uuid;
    EXCEPTION WHEN others THEN
      target_listing_id := NULL;
    END;
  END IF;

  -- Only mark as internal if NOT already published to marketplace
  -- This prevents accidentally hiding a live marketplace listing
  IF target_listing_id IS NOT NULL THEN
    UPDATE public.listings
    SET is_internal_deal = true
    WHERE id = target_listing_id
      AND published_at IS NULL
      AND is_internal_deal = false;
  END IF;

  RETURN NEW;
END;
$$;