-- CapTarget Deals Integration
-- Adds deal source tracking, CapTarget-specific columns, sync log table, and backfill

-- 1. Add deal_source column to listings (tracks origin of every deal platform-wide)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS deal_source TEXT DEFAULT 'manual';

-- 2. Add CapTarget-specific columns to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_client_name TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_contact_date TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_outreach_channel TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_interest_type TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_row_hash TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_source_url TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS captarget_call_notes TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS pushed_to_all_deals BOOLEAN DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS pushed_to_all_deals_at TIMESTAMPTZ;

-- 3. Index on captarget_row_hash for fast upsert matching during sync
CREATE INDEX IF NOT EXISTS idx_listings_captarget_row_hash ON public.listings (captarget_row_hash) WHERE captarget_row_hash IS NOT NULL;

-- 4. Index on deal_source for filtering
CREATE INDEX IF NOT EXISTS idx_listings_deal_source ON public.listings (deal_source);

-- 5. Create captarget_sync_log table
CREATE TABLE IF NOT EXISTS public.captarget_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  rows_read INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success'
);

-- Enable RLS on sync log
ALTER TABLE public.captarget_sync_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access to sync log
CREATE POLICY "Admin users can view captarget sync logs"
  ON public.captarget_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 6. Backfill deal_source for existing deals
-- Referral deals: linked to a referral partner or pending referral review
UPDATE public.listings
SET deal_source = 'referral'
WHERE deal_source IS NULL OR deal_source = 'manual'
  AND (
    referral_partner_id IS NOT NULL
    OR status = 'pending_referral_review'
  );

-- Marketplace deals: those with published_at set (were published to marketplace)
UPDATE public.listings
SET deal_source = 'marketplace'
WHERE (deal_source IS NULL OR deal_source = 'manual')
  AND published_at IS NOT NULL;

-- Everything else defaults to 'manual' (already the column default)
UPDATE public.listings
SET deal_source = 'manual'
WHERE deal_source IS NULL;
