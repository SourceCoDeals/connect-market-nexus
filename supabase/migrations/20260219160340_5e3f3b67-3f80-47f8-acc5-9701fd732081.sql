
-- Reset enrichment_queue records that are 'completed' but their listing has no executive_summary
-- These were marked completed during a failed scrape pass and need to be re-enriched
UPDATE enrichment_queue eq
SET 
  status = 'pending',
  force = true,
  attempts = 0,
  completed_at = NULL,
  last_error = NULL,
  started_at = NULL,
  queued_at = NOW()
FROM listings l
WHERE eq.listing_id = l.id
  AND eq.status = 'completed'
  AND l.executive_summary IS NULL
  AND l.enriched_at IS NOT NULL;
