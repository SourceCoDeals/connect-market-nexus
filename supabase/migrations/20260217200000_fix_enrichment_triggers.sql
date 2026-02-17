-- Fix: Recreate enrichment trigger functions without references to dropped columns
-- (enrichment_scheduled_at, enrichment_refresh_due_at were dropped by 20260217130000)

-- 1) Recreate queue_listing_enrichment (BEFORE INSERT/UPDATE trigger function)
--    Used by: auto_enrich_updated_listing
CREATE OR REPLACE FUNCTION queue_listing_enrichment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.website IS NOT NULL OR NEW.internal_deal_memo_link IS NOT NULL)
     AND (NEW.enriched_at IS NULL OR NEW.enriched_at < NOW() - INTERVAL '90 days') THEN

    INSERT INTO public.enrichment_queue (listing_id, queued_at, status)
    VALUES (NEW.id, NOW(), 'pending')
    ON CONFLICT (listing_id) DO UPDATE SET
      queued_at = NOW(),
      status = 'pending',
      attempts = 0;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Recreate queue_deal_for_enrichment (BEFORE UPDATE trigger function)
CREATE OR REPLACE FUNCTION queue_deal_for_enrichment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Recreate queue_deal_for_enrichment_after_insert (AFTER INSERT trigger function)
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

-- 4) Ensure triggers are correctly attached
-- auto_enrich_new_listing should be AFTER INSERT (not BEFORE, to avoid FK violation)
DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
CREATE TRIGGER auto_enrich_new_listing
AFTER INSERT ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.queue_deal_for_enrichment_after_insert();

-- auto_enrich_updated_listing stays as BEFORE UPDATE
DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON public.listings;
CREATE TRIGGER auto_enrich_updated_listing
BEFORE UPDATE OF website, internal_deal_memo_link ON public.listings
FOR EACH ROW
WHEN (OLD.website IS DISTINCT FROM NEW.website OR OLD.internal_deal_memo_link IS DISTINCT FROM NEW.internal_deal_memo_link)
EXECUTE FUNCTION queue_deal_for_enrichment();

-- 5) Recreate the view without enrichment_refresh_due_at
CREATE OR REPLACE VIEW public.listings_needing_enrichment AS
SELECT
  l.id,
  l.title,
  l.internal_company_name,
  l.website,
  l.enriched_at,
  l.created_at,
  eq.status AS queue_status,
  eq.attempts AS queue_attempts,
  eq.last_error,
  eq.queued_at
FROM public.listings l
LEFT JOIN public.enrichment_queue eq ON l.id = eq.listing_id
WHERE l.deleted_at IS NULL
  AND l.status = 'active'
  AND (l.website IS NOT NULL OR l.internal_deal_memo_link IS NOT NULL)
  AND (l.enriched_at IS NULL OR l.enriched_at < NOW() - INTERVAL '90 days');
