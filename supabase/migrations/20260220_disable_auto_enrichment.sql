-- Disable auto-enrichment: drop DB triggers and cron job
-- Manual enrichment (via admin buttons) still works — only automatic triggers are removed.

-- Drop the auto-enrich triggers on listings table
DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON public.listings;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS public.queue_listing_enrichment();
DROP FUNCTION IF EXISTS public.queue_deal_for_enrichment();

-- Unschedule the cron job that processes the enrichment queue every 5 minutes
SELECT cron.unschedule('process-enrichment-queue');
