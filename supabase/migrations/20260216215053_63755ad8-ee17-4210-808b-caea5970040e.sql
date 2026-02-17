-- Clear contaminated financial data from CapTarget deals that have no transcript backing
-- Only affects deals where revenue/ebitda came from website scraping (no transcript exists)
UPDATE public.listings l
SET 
  revenue = NULL,
  revenue_confidence = NULL,
  revenue_source_quote = NULL,
  revenue_is_inferred = NULL,
  revenue_metric_subtitle = NULL,
  revenue_score = NULL,
  ebitda = NULL,
  ebitda_confidence = NULL,
  ebitda_source_quote = NULL,
  ebitda_is_inferred = NULL,
  ebitda_metric_subtitle = NULL,
  ebitda_margin = NULL,
  ebitda_score = NULL,
  financial_notes = NULL,
  financial_followup_questions = NULL
WHERE l.deal_source = 'captarget'
  AND (l.revenue IS NOT NULL OR l.ebitda IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_transcripts dt WHERE dt.listing_id = l.id
  );