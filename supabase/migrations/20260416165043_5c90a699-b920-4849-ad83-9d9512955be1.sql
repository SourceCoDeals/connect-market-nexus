ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS website_enrichment_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website_enriched_at TIMESTAMPTZ DEFAULT NULL;