-- ============================================================================
-- MIGRATION: SourceCo Salesforce Remarketing Integration
-- ============================================================================
-- Adds support for deals arriving from Salesforce via the SourceCo remarketing
-- webhook. Follows the same pattern as CapTarget and GP Partners — deals land
-- in the `listings` table with `deal_source = 'salesforce_remarketing'`.
--
-- Changes:
--   1. Add salesforce_account_id to listings (deduplication key for SF upserts)
--   2. Add SourceCo-specific metadata columns to listings
--   3. Create indexes for efficient lookups
-- ============================================================================

-- 1. Salesforce Account ID — unique key to prevent duplicate deals when the
--    same Account triggers the webhook more than once.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS salesforce_account_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_salesforce_account_id
  ON public.listings (salesforce_account_id)
  WHERE salesforce_account_id IS NOT NULL;

-- 2. SourceCo-specific metadata columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sf_remarketing_reason TEXT,
  ADD COLUMN IF NOT EXISTS sf_primary_client_account TEXT,
  ADD COLUMN IF NOT EXISTS sf_target_stage TEXT,
  ADD COLUMN IF NOT EXISTS sf_target_sub_stage TEXT,
  ADD COLUMN IF NOT EXISTS sf_interest_in_selling TEXT,
  ADD COLUMN IF NOT EXISTS sf_seller_interest_score NUMERIC,
  ADD COLUMN IF NOT EXISTS sf_note_summary TEXT,
  ADD COLUMN IF NOT EXISTS sf_most_recent_update TEXT,
  ADD COLUMN IF NOT EXISTS sf_one_pager BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sf_lead_memo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sf_nda BOOLEAN DEFAULT false;

-- 3. Index on deal_source for salesforce_remarketing filtering
CREATE INDEX IF NOT EXISTS idx_listings_deal_source_sf_remarketing
  ON public.listings (deal_source)
  WHERE deal_source = 'salesforce_remarketing';
