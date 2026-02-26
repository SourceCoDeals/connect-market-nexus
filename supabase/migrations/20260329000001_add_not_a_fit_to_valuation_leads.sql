-- Add not_a_fit boolean column to valuation_leads
-- Allows marking valuation calculator leads as "Not a Fit" independently of the listings table

ALTER TABLE valuation_leads ADD COLUMN IF NOT EXISTS not_a_fit boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_valuation_leads_not_a_fit ON valuation_leads (not_a_fit);
