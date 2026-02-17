ALTER TABLE public.enrichment_queue
  ADD COLUMN IF NOT EXISTS force boolean DEFAULT false;

ALTER TABLE public.buyer_enrichment_queue
  ADD COLUMN IF NOT EXISTS force boolean DEFAULT false;