-- Add financial tracking columns per deal enrichment spec
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS financial_notes TEXT,
  ADD COLUMN IF NOT EXISTS financial_followup_questions TEXT[],
  ADD COLUMN IF NOT EXISTS ebitda_margin DECIMAL,
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;

-- Add index for auto-enrichment query (deals that need enrichment)
CREATE INDEX IF NOT EXISTS idx_listings_last_enriched_at ON public.listings(last_enriched_at);

COMMENT ON COLUMN public.listings.financial_notes IS 'Notes and flags for deal team regarding financial data interpretation';
COMMENT ON COLUMN public.listings.financial_followup_questions IS 'Questions to clarify financials in follow-up call';
COMMENT ON COLUMN public.listings.ebitda_margin IS 'EBITDA margin as decimal (e.g., 0.15 for 15%)';
COMMENT ON COLUMN public.listings.last_enriched_at IS 'Cache timestamp for auto-enrichment trigger';