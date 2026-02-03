-- ============================================================
-- ENRICHMENT PIPELINE INFRASTRUCTURE
-- Creates queue table, triggers, and supporting columns
-- ============================================================

-- 1. Add enrichment tracking columns to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS enrichment_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_refresh_due_at TIMESTAMPTZ;

-- 2. Add LinkedIn data columns if they don't exist
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS linkedin_employee_count INTEGER,
  ADD COLUMN IF NOT EXISTS linkedin_employee_range TEXT;

-- 3. Create enrichment queue table
CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enrichment_queue_listing_unique UNIQUE (listing_id)
);

-- Enable RLS
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view enrichment queue" ON enrichment_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can manage enrichment queue" ON enrichment_queue
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Service role access (for background jobs)
CREATE POLICY "Service role can manage enrichment queue" ON enrichment_queue
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Create function to queue deal for enrichment
CREATE OR REPLACE FUNCTION queue_deal_for_enrichment()
RETURNS TRIGGER AS $$
DECLARE
  has_website BOOLEAN;
BEGIN
  -- Check if deal has a website (from website field or internal_deal_memo_link)
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

  -- Only queue if has website and not already enriched recently
  IF has_website AND (NEW.enriched_at IS NULL OR NEW.enriched_at < NOW() - INTERVAL '30 days') THEN
    INSERT INTO enrichment_queue (listing_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (listing_id) 
    DO UPDATE SET 
      status = 'pending',
      queued_at = NOW(),
      updated_at = NOW()
    WHERE enrichment_queue.status IN ('failed', 'completed');
    
    -- Mark when enrichment was scheduled
    NEW.enrichment_scheduled_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create triggers for auto-enrichment
DROP TRIGGER IF EXISTS auto_enrich_new_listing ON listings;
CREATE TRIGGER auto_enrich_new_listing
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION queue_deal_for_enrichment();

DROP TRIGGER IF EXISTS auto_enrich_updated_listing ON listings;
CREATE TRIGGER auto_enrich_updated_listing
  BEFORE UPDATE OF website, internal_deal_memo_link ON listings
  FOR EACH ROW
  WHEN (
    OLD.website IS DISTINCT FROM NEW.website OR 
    OLD.internal_deal_memo_link IS DISTINCT FROM NEW.internal_deal_memo_link
  )
  EXECUTE FUNCTION queue_deal_for_enrichment();

-- 6. Create view for monitoring enrichment needs
CREATE OR REPLACE VIEW listings_needing_enrichment AS
SELECT 
  l.id,
  l.title,
  l.internal_company_name,
  l.website,
  l.internal_deal_memo_link,
  l.enriched_at,
  l.enrichment_scheduled_at,
  l.created_at,
  eq.status as queue_status,
  eq.attempts,
  eq.last_error,
  eq.queued_at
FROM listings l
LEFT JOIN enrichment_queue eq ON l.id = eq.listing_id
WHERE l.deleted_at IS NULL
  AND (l.website IS NOT NULL OR (
    l.internal_deal_memo_link IS NOT NULL 
    AND l.internal_deal_memo_link NOT LIKE '%sharepoint%'
    AND l.internal_deal_memo_link NOT LIKE '%onedrive%'
  ))
  AND (l.enriched_at IS NULL OR l.enriched_at < NOW() - INTERVAL '30 days')
ORDER BY l.created_at DESC;

-- 7. Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_pending 
  ON enrichment_queue(status, queued_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_listing 
  ON enrichment_queue(listing_id);

-- 8. Backfill website column from internal_deal_memo_link
-- (Normalizes data so enrichment works consistently)
UPDATE listings
SET website = internal_deal_memo_link
WHERE website IS NULL
  AND internal_deal_memo_link IS NOT NULL
  AND internal_deal_memo_link NOT LIKE '%sharepoint%'
  AND internal_deal_memo_link NOT LIKE '%onedrive%'
  AND (internal_deal_memo_link LIKE 'http%' 
       OR internal_deal_memo_link ~ '^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}');