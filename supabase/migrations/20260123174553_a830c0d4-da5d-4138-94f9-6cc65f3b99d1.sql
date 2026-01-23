-- Add missing buyer columns for Whispers parity
ALTER TABLE remarketing_buyers 
  ADD COLUMN IF NOT EXISTS hq_city TEXT,
  ADD COLUMN IF NOT EXISTS hq_state TEXT,
  ADD COLUMN IF NOT EXISTS deal_breakers TEXT[],
  ADD COLUMN IF NOT EXISTS strategic_priorities TEXT[],
  ADD COLUMN IF NOT EXISTS deal_preferences TEXT,
  ADD COLUMN IF NOT EXISTS specialized_focus TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_timeline TEXT,
  ADD COLUMN IF NOT EXISTS revenue_sweet_spot NUMERIC,
  ADD COLUMN IF NOT EXISTS ebitda_sweet_spot NUMERIC,
  ADD COLUMN IF NOT EXISTS acquisition_appetite TEXT,
  ADD COLUMN IF NOT EXISTS total_acquisitions INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN remarketing_buyers.deal_breakers IS 'Array of deal breaker conditions (e.g., "Avoids DRP", "No shops under $1M")';
COMMENT ON COLUMN remarketing_buyers.strategic_priorities IS 'Array of strategic acquisition priorities';
COMMENT ON COLUMN remarketing_buyers.revenue_sweet_spot IS 'Ideal revenue target for acquisitions';
COMMENT ON COLUMN remarketing_buyers.ebitda_sweet_spot IS 'Ideal EBITDA target for acquisitions';