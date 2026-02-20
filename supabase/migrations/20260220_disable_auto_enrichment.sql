-- DISABLE AUTO-ENRICHMENT
-- All enrichment is now manual-only (triggered by admin button clicks).
-- This removes DB triggers that auto-queue enrichment on INSERT/UPDATE,
-- and the cron job that processes the queue every 5 minutes.

-- ============================================================================
-- PART 1: Drop auto-enrich triggers on listings table
-- ============================================================================

DROP TRIGGER IF EXISTS auto_enrich_new_listing ON public.listings;
DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON public.listings;

-- Drop the trigger functions (no longer needed)
DROP FUNCTION IF EXISTS public.queue_listing_enrichment() CASCADE;
DROP FUNCTION IF EXISTS public.queue_deal_for_enrichment() CASCADE;
DROP FUNCTION IF EXISTS public.queue_deal_for_enrichment_after_insert() CASCADE;

-- ============================================================================
-- PART 2: Remove the cron job that auto-processes the enrichment queue
-- ============================================================================

-- Unschedule the cron job (safe even if it doesn't exist)
SELECT cron.unschedule('process-enrichment-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-enrichment-queue'
);

-- Drop the trigger function that the cron job calls
DROP FUNCTION IF EXISTS public.trigger_enrichment_queue_processor() CASCADE;

-- ============================================================================
-- PART 3: Clean up any stale pending items in the queue
-- (so they don't sit there forever — mark them as cancelled)
-- ============================================================================

UPDATE public.enrichment_queue
SET status = 'cancelled', updated_at = NOW()
WHERE status IN ('pending', 'scheduled');

UPDATE public.buyer_enrichment_queue
SET status = 'cancelled', updated_at = NOW()
WHERE status IN ('pending', 'rate_limited');
