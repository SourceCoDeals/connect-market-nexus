-- Fix FK violation: enrichment_queue insert was happening in a BEFORE INSERT trigger
-- which fails because the referenced listings row doesn't exist yet.

-- 1) Create an AFTER INSERT trigger function that queues enrichment and then stamps the listing.
CREATE OR REPLACE FUNCTION public.queue_deal_for_enrichment_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  has_website BOOLEAN;
BEGIN
  has_website := (
    NEW.website IS NOT NULL AND NEW.website != ''
  ) OR (
    NEW.internal_deal_memo_link IS NOT NULL
    AND NEW.internal_deal_memo_link != ''
    AND NEW.internal_deal_memo_link NOT LIKE '%sharepoint%'
    AND NEW.internal_deal_memo_link NOT LIKE '%onedrive%'
    AND (
      NEW.internal_deal_memo_link LIKE 'http%'
      OR NEW.internal_deal_memo_link ~ '^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}'
    )
  );

  IF has_website AND (NEW.enriched_at IS NULL OR NEW.enriched_at < NOW() - INTERVAL '30 days') THEN
    INSERT INTO public.enrichment_queue (listing_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (listing_id)
    DO UPDATE SET
      status = 'pending',
      queued_at = NOW(),
      updated_at = NOW()
    WHERE enrichment_queue.status IN ('failed', 'completed');

    -- In AFTER trigger we can't mutate NEW, so stamp via UPDATE
    UPDATE public.listings
    SET enrichment_scheduled_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Replace the BEFORE INSERT trigger with an AFTER INSERT trigger.
DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
CREATE TRIGGER auto_enrich_new_listing
AFTER INSERT ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.queue_deal_for_enrichment_after_insert();
