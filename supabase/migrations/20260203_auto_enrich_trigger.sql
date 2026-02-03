-- Migration: Auto-enrich deals on insert and track refresh cycle
-- Deals auto-enrich when added, refresh every 3 months

-- =============================================================
-- ADD ENRICHMENT TRACKING COLUMNS (if not exist)
-- =============================================================

-- enriched_at already exists, add enrichment schedule tracking
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS enrichment_scheduled_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS enrichment_refresh_due_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================
-- CREATE FUNCTION TO CHECK IF ENRICHMENT IS DUE
-- =============================================================

CREATE OR REPLACE FUNCTION is_enrichment_due(listing_row public.listings)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Never enriched - needs enrichment
  IF listing_row.enriched_at IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if 3 months (90 days) have passed since last enrichment
  IF listing_row.enriched_at < NOW() - INTERVAL '90 days' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- =============================================================
-- CREATE FUNCTION TO QUEUE ENRICHMENT
-- =============================================================

CREATE OR REPLACE FUNCTION queue_listing_enrichment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only queue if has a website URL and not already scheduled
  IF (NEW.website IS NOT NULL OR NEW.internal_deal_memo_link IS NOT NULL)
     AND NEW.enrichment_scheduled_at IS NULL
     AND (NEW.enriched_at IS NULL OR NEW.enriched_at < NOW() - INTERVAL '90 days') THEN

    -- Mark as scheduled for enrichment
    NEW.enrichment_scheduled_at := NOW();
    NEW.enrichment_refresh_due_at := NOW() + INTERVAL '90 days';

    -- Insert into enrichment queue table
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

-- =============================================================
-- CREATE ENRICHMENT QUEUE TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT enrichment_queue_listing_unique UNIQUE (listing_id)
);

CREATE INDEX idx_enrichment_queue_status ON public.enrichment_queue(status, queued_at);
CREATE INDEX idx_enrichment_queue_listing ON public.enrichment_queue(listing_id);

-- =============================================================
-- CREATE TRIGGER FOR NEW LISTINGS
-- =============================================================

DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
CREATE TRIGGER auto_enrich_new_listing
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION queue_listing_enrichment();

-- Also trigger on update when website is added
DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON public.listings;
CREATE TRIGGER auto_enrich_updated_listing
  BEFORE UPDATE OF website, internal_deal_memo_link ON public.listings
  FOR EACH ROW
  WHEN (OLD.website IS DISTINCT FROM NEW.website OR OLD.internal_deal_memo_link IS DISTINCT FROM NEW.internal_deal_memo_link)
  EXECUTE FUNCTION queue_listing_enrichment();

-- =============================================================
-- CREATE VIEW FOR STALE LISTINGS (need refresh)
-- =============================================================

CREATE OR REPLACE VIEW public.listings_needing_enrichment AS
SELECT
  l.id,
  l.title,
  l.internal_company_name,
  l.website,
  l.enriched_at,
  l.enrichment_refresh_due_at,
  CASE
    WHEN l.enriched_at IS NULL THEN 'never_enriched'
    WHEN l.enriched_at < NOW() - INTERVAL '90 days' THEN 'stale'
    ELSE 'current'
  END AS enrichment_status,
  eq.status AS queue_status,
  eq.attempts AS queue_attempts,
  eq.last_error
FROM public.listings l
LEFT JOIN public.enrichment_queue eq ON l.id = eq.listing_id
WHERE l.deleted_at IS NULL
  AND l.status = 'active'
  AND (l.website IS NOT NULL OR l.internal_deal_memo_link IS NOT NULL)
  AND (l.enriched_at IS NULL OR l.enriched_at < NOW() - INTERVAL '90 days');

-- =============================================================
-- FUNCTION TO PROCESS ENRICHMENT QUEUE
-- =============================================================

CREATE OR REPLACE FUNCTION process_enrichment_queue_batch(batch_size INTEGER DEFAULT 5)
RETURNS TABLE (
  processed INTEGER,
  succeeded INTEGER,
  failed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed INTEGER := 0;
  v_succeeded INTEGER := 0;
  v_failed INTEGER := 0;
  v_queue_item RECORD;
BEGIN
  -- Get pending items (oldest first, max 3 attempts)
  FOR v_queue_item IN
    SELECT eq.*, l.website, l.internal_deal_memo_link
    FROM public.enrichment_queue eq
    JOIN public.listings l ON eq.listing_id = l.id
    WHERE eq.status = 'pending' AND eq.attempts < 3
    ORDER BY eq.queued_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark as processing
    UPDATE public.enrichment_queue
    SET status = 'processing', started_at = NOW(), attempts = attempts + 1
    WHERE id = v_queue_item.id;

    v_processed := v_processed + 1;

    -- Note: Actual enrichment is handled by edge function called via cron
    -- This just marks items for processing

  END LOOP;

  RETURN QUERY SELECT v_processed, v_succeeded, v_failed;
END;
$$;

-- =============================================================
-- GRANT PERMISSIONS
-- =============================================================

GRANT SELECT ON public.listings_needing_enrichment TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.enrichment_queue TO authenticated;
GRANT EXECUTE ON FUNCTION is_enrichment_due TO authenticated;
GRANT EXECUTE ON FUNCTION process_enrichment_queue_batch TO authenticated;

COMMENT ON TABLE public.enrichment_queue IS 'Queue of listings pending enrichment';
COMMENT ON VIEW public.listings_needing_enrichment IS 'Listings that need initial or refresh enrichment';
COMMENT ON COLUMN public.listings.enrichment_refresh_due_at IS 'When this listing should be re-enriched (90 days after last enrichment)';
