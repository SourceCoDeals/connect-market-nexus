
-- Drop existing broken triggers
DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON public.listings;

-- Recreate AFTER INSERT function without enrichment_scheduled_at reference
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
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate BEFORE UPDATE function without enrichment_scheduled_at reference
CREATE OR REPLACE FUNCTION public.queue_deal_for_enrichment()
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
    INSERT INTO enrichment_queue (listing_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (listing_id) 
    DO UPDATE SET 
      status = 'pending',
      queued_at = NOW(),
      updated_at = NOW()
    WHERE enrichment_queue.status IN ('failed', 'completed');
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate triggers
CREATE TRIGGER auto_enrich_new_listing
AFTER INSERT ON public.listings
FOR EACH ROW
EXECUTE FUNCTION queue_deal_for_enrichment_after_insert();

CREATE TRIGGER auto_enrich_updated_listing
BEFORE UPDATE OF website, internal_deal_memo_link ON public.listings
FOR EACH ROW
WHEN ((old.website IS DISTINCT FROM new.website) OR (old.internal_deal_memo_link IS DISTINCT FROM new.internal_deal_memo_link))
EXECUTE FUNCTION queue_deal_for_enrichment();
