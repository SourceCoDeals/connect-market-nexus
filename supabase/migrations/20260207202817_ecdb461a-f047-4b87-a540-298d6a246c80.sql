-- Fix FK constraint on listing_analytics to cascade on delete
ALTER TABLE IF EXISTS public.listing_analytics
  DROP CONSTRAINT IF EXISTS listing_analytics_listing_id_fkey;

ALTER TABLE IF EXISTS public.listing_analytics
  ADD CONSTRAINT listing_analytics_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;