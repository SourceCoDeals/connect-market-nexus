-- ============================================================================
-- VALUATION LEADS AUDIT FIXES
-- Addresses findings from comprehensive technical audit (2026-02-19)
-- ============================================================================

-- ─── FINDING-001: Deduplicate remaining records ───
-- Remove duplicate valuation_leads keeping the newest per email (case-insensitive)
DELETE FROM public.valuation_leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY LOWER(TRIM(email))
             ORDER BY created_at DESC
           ) AS rn
    FROM public.valuation_leads
    WHERE email IS NOT NULL AND TRIM(email) <> ''
  ) ranked
  WHERE rn > 1
);

-- ─── FINDING-003: Exclude junk financial records ───
-- Mark leads with unrealistically low financials as excluded
UPDATE public.valuation_leads
SET excluded = true,
    exclusion_reason = 'junk_financials'
WHERE excluded = false
  AND (
    (revenue IS NOT NULL AND revenue > 0 AND revenue < 1000)
    OR (ebitda IS NOT NULL AND ebitda > 0 AND ebitda < 100)
  );

-- ─── FINDING-008: Exclude disposable email leads ───
-- Known disposable/temp email domains from seed data
UPDATE public.valuation_leads
SET excluded = true,
    exclusion_reason = 'disposable_email'
WHERE excluded = false
  AND email IS NOT NULL
  AND (
    LOWER(email) LIKE '%@leabro.com'
    OR LOWER(email) LIKE '%@coursora.com'
    OR LOWER(email) LIKE '%@webxio.pro'
  );

-- ─── FINDING-003b: Flag outlier $1.1B revenue record ───
-- Don't exclude but flag for review
UPDATE public.valuation_leads
SET exclusion_reason = 'review_outlier_revenue'
WHERE excluded = false
  AND revenue > 500000000
  AND exclusion_reason IS NULL;

-- ─── Non-NA leads: Exclude non-North-American leads from main list ───
-- Per CTO direction: only display North American leads, store others separately
UPDATE public.valuation_leads
SET excluded = true,
    exclusion_reason = 'non_north_american'
WHERE excluded = false
  AND region IS NOT NULL
  AND LOWER(region) NOT IN ('na', 'north america', 'north-america', 'us', 'usa', 'united states', 'canada', 'ca', 'mexico', 'mx')
  AND region != 'NA';

-- ─── FINDING-013: Fix FK ON DELETE behavior ───
-- Change pushed_listing_id FK to SET NULL on delete (instead of RESTRICT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valuation_leads_pushed_listing_id_fkey'
      AND table_name = 'valuation_leads'
  ) THEN
    ALTER TABLE public.valuation_leads
      DROP CONSTRAINT valuation_leads_pushed_listing_id_fkey;
  END IF;

  ALTER TABLE public.valuation_leads
    ADD CONSTRAINT valuation_leads_pushed_listing_id_fkey
    FOREIGN KEY (pushed_listing_id) REFERENCES public.listings(id)
    ON DELETE SET NULL;
END $$;

-- ─── FINDING-015: Add CHECK constraints on enum-like columns ───
ALTER TABLE public.valuation_leads
  DROP CONSTRAINT IF EXISTS chk_exit_timing;
ALTER TABLE public.valuation_leads
  ADD CONSTRAINT chk_exit_timing
  CHECK (exit_timing IS NULL OR exit_timing IN ('now', '1-2years', 'exploring'));

ALTER TABLE public.valuation_leads
  DROP CONSTRAINT IF EXISTS chk_quality_label;
ALTER TABLE public.valuation_leads
  ADD CONSTRAINT chk_quality_label
  CHECK (quality_label IS NULL OR quality_label IN ('Very Strong', 'Strong', 'Solid', 'Average', 'Needs Work'));

ALTER TABLE public.valuation_leads
  DROP CONSTRAINT IF EXISTS chk_calculator_type;
ALTER TABLE public.valuation_leads
  ADD CONSTRAINT chk_calculator_type
  CHECK (calculator_type IN ('general', 'auto_shop', 'hvac', 'collision', 'dental', 'plumbing', 'electrical', 'landscaping', 'pest_control'));

-- ─── FINDING-022: Add composite indexes for common query patterns ───
CREATE INDEX IF NOT EXISTS idx_valuation_leads_excluded_score
  ON public.valuation_leads (excluded, lead_score)
  WHERE excluded = false;

CREATE INDEX IF NOT EXISTS idx_valuation_leads_excluded_pushed
  ON public.valuation_leads (excluded, pushed_to_all_deals)
  WHERE excluded = false;

CREATE INDEX IF NOT EXISTS idx_valuation_leads_calculator_type_excluded
  ON public.valuation_leads (calculator_type, excluded)
  WHERE excluded = false;

-- ─── FINDING-029: Harden dedup trigger for case-insensitive matching ───
CREATE OR REPLACE FUNCTION public.valuation_leads_dedup_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  existing_id uuid;
BEGIN
  -- Skip dedup if email is null or empty
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- Find existing record with same email (case-insensitive)
  SELECT id INTO existing_id
  FROM public.valuation_leads
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND excluded = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Update existing record with newer financial data
    UPDATE public.valuation_leads
    SET
      revenue = COALESCE(NEW.revenue, revenue),
      ebitda = COALESCE(NEW.ebitda, ebitda),
      valuation_low = COALESCE(NEW.valuation_low, valuation_low),
      valuation_mid = COALESCE(NEW.valuation_mid, valuation_mid),
      valuation_high = COALESCE(NEW.valuation_high, valuation_high),
      updated_at = NOW()
    WHERE id = existing_id;
    RETURN NULL; -- Cancel the INSERT
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_valuation_leads_dedup ON public.valuation_leads;
CREATE TRIGGER trg_valuation_leads_dedup
  BEFORE INSERT ON public.valuation_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.valuation_leads_dedup_check();
