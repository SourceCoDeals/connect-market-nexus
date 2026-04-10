-- Capture close-reason and final outcome data on deal_pipeline.
-- Adds structured columns so Closed Won and Closed Lost can carry metadata
-- for reporting (revenue recognized, loss post-mortems) instead of relying on
-- free-text notes.

ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS final_price NUMERIC,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS lost_to_competitor TEXT;

-- Enumerated loss reasons — broker/M&A-specific post-mortem taxonomy.
-- Kept as a CHECK constraint so it is easy to extend later.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'deal_pipeline'
      AND constraint_name = 'deal_pipeline_lost_reason_check'
  ) THEN
    ALTER TABLE public.deal_pipeline
      ADD CONSTRAINT deal_pipeline_lost_reason_check
      CHECK (
        lost_reason IS NULL OR lost_reason IN (
          'price_too_high',
          'price_too_low',
          'no_fit',
          'competitor_won',
          'buyer_walked',
          'seller_walked',
          'financing_failed',
          'diligence_failed',
          'timing',
          'regulatory',
          'other'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.deal_pipeline.final_price IS
  'Negotiated purchase price captured when the deal is marked Closed Won.';
COMMENT ON COLUMN public.deal_pipeline.closed_at IS
  'Timestamp when the deal first entered a Closed Won or Closed Lost stage.';
COMMENT ON COLUMN public.deal_pipeline.lost_reason IS
  'Categorical reason captured when the deal is marked Closed Lost.';
COMMENT ON COLUMN public.deal_pipeline.lost_reason_detail IS
  'Free-text context about why the deal was lost.';
COMMENT ON COLUMN public.deal_pipeline.lost_to_competitor IS
  'Optional name of the competing broker/buyer that won instead.';
