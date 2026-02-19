-- ============================================================
-- Add deal_owner_id to valuation_leads so owners can be assigned
-- before pushing to All Deals
-- ============================================================

ALTER TABLE valuation_leads
  ADD COLUMN IF NOT EXISTS deal_owner_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_valuation_leads_deal_owner
  ON valuation_leads (deal_owner_id)
  WHERE deal_owner_id IS NOT NULL;
