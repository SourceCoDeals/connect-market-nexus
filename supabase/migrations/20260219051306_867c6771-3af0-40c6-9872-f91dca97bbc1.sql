
-- =========================================================
-- FIX 1: Recreate dedup trigger to fire on BOTH INSERT and UPDATE
-- =========================================================
DROP TRIGGER IF EXISTS trg_prevent_valuation_lead_duplicates ON public.valuation_leads;

-- Recreate firing on INSERT and UPDATE
CREATE TRIGGER trg_prevent_valuation_lead_duplicates
  BEFORE INSERT OR UPDATE ON public.valuation_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_valuation_lead_duplicates();

-- =========================================================
-- FIX 2: Add partial unique index for email+calculator_type 
-- on non-excluded records (catches leads without source_submission_id)
-- =========================================================
DROP INDEX IF EXISTS idx_valuation_leads_email_calc_type_active;

CREATE UNIQUE INDEX idx_valuation_leads_email_calc_type_active
  ON public.valuation_leads (email, calculator_type)
  WHERE (excluded = false AND email IS NOT NULL);

-- =========================================================
-- FIX 3: Backfill quality_label from quality_tier + lead_score
-- The label is a more descriptive version of the tier/score combo
-- =========================================================
UPDATE public.valuation_leads
SET quality_label = CASE
  WHEN lead_score >= 70 THEN 'Very Strong'
  WHEN lead_score >= 55 THEN 'Strong'
  WHEN lead_score >= 40 THEN 'Solid'
  WHEN lead_score >= 25 THEN 'Average'
  WHEN lead_score IS NOT NULL THEN 'Needs Work'
  ELSE NULL
END
WHERE quality_label IS NULL AND lead_score IS NOT NULL;
