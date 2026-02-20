-- ============================================================================
-- REMARKETING → PIPELINE BRIDGE: Connect remarketing scores to CRM deals
--
-- PURPOSE: Allow remarketing buyers marked as "interested" to flow into the
-- unified deals pipeline. Adds FK columns on deals to track which remarketing
-- buyer and score originated the deal.
--
-- SAFETY:
--   - ADDITIVE ONLY: Adds columns and indexes. No existing columns modified.
--   - NO DATA LOSS: All existing deals, scores, buyers preserved as-is.
--   - FULLY REVERSIBLE: DROP COLUMN IF EXISTS for both new columns.
--   - Existing deal creation paths (marketplace, webflow, import) unchanged.
--   - New 'remarketing' source value enables pipeline filtering by origin.
-- ============================================================================

-- 1. Add remarketing FK columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS remarketing_score_id UUID,
  ADD COLUMN IF NOT EXISTS remarketing_buyer_id UUID;

-- 2. Add foreign key constraints (separate statements for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_remarketing_score_id_fkey'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_remarketing_score_id_fkey
      FOREIGN KEY (remarketing_score_id) REFERENCES public.remarketing_scores(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_remarketing_buyer_id_fkey'
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_remarketing_buyer_id_fkey
      FOREIGN KEY (remarketing_buyer_id) REFERENCES public.remarketing_buyers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Update source constraint to include 'remarketing'
ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_source_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_source_check
  CHECK (source = ANY (ARRAY[
    'manual'::text,
    'marketplace'::text,
    'webflow'::text,
    'import'::text,
    'website'::text,
    'remarketing'::text
  ]));

-- 4. Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_deals_remarketing_buyer_id
  ON public.deals(remarketing_buyer_id)
  WHERE remarketing_buyer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_remarketing_score_id
  ON public.deals(remarketing_score_id)
  WHERE remarketing_score_id IS NOT NULL;

-- 5. Composite index: find pipeline deals for a specific buyer + listing
CREATE INDEX IF NOT EXISTS idx_deals_remarketing_buyer_listing
  ON public.deals(remarketing_buyer_id, listing_id)
  WHERE remarketing_buyer_id IS NOT NULL AND deleted_at IS NULL;
