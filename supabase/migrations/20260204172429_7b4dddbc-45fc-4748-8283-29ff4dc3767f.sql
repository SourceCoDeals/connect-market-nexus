-- Add M&A Intelligence columns to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deal_score integer;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS extraction_sources jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS industry_kpis jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS contact_title text;

-- Add index for deal scoring
CREATE INDEX IF NOT EXISTS idx_deals_deal_score ON public.deals(deal_score DESC);