
-- Add Salesforce-specific columns to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS salesforce_account_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_record_type_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_remarketing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sf_remarketing_cb_create_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sf_remarketing_reason TEXT,
  ADD COLUMN IF NOT EXISTS sf_remarketing_target_stages TEXT,
  ADD COLUMN IF NOT EXISTS sf_target_stage TEXT,
  ADD COLUMN IF NOT EXISTS sf_target_sub_stage TEXT,
  ADD COLUMN IF NOT EXISTS sf_marketplace_sub_stage TEXT,
  ADD COLUMN IF NOT EXISTS sf_interest_in_selling TEXT,
  ADD COLUMN IF NOT EXISTS sf_tier TEXT,
  ADD COLUMN IF NOT EXISTS sf_owner_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_previous_search_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_primary_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_primary_client_account_id TEXT,
  ADD COLUMN IF NOT EXISTS sf_note_summary TEXT,
  ADD COLUMN IF NOT EXISTS sf_historic_note_summary TEXT,
  ADD COLUMN IF NOT EXISTS sf_remarks_internal TEXT,
  ADD COLUMN IF NOT EXISTS sf_last_modified_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sf_created_date TIMESTAMPTZ;

-- Unique partial index for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_salesforce_account_id
  ON public.listings (salesforce_account_id)
  WHERE salesforce_account_id IS NOT NULL;
