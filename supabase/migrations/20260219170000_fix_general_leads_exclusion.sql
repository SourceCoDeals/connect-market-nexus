-- ============================================================================
-- FIX: Restore incorrectly excluded General calculator leads
--
-- The audit migration (20260219120000) excluded North American general leads
-- because 'north-america' (hyphenated) was not in the allowed region list.
-- This corrective migration un-excludes those leads.
-- ============================================================================

-- Un-exclude leads that were incorrectly marked as non_north_american
-- but actually have a North American region value (hyphenated form)
UPDATE public.valuation_leads
SET excluded = false,
    exclusion_reason = NULL
WHERE excluded = true
  AND exclusion_reason = 'non_north_american'
  AND LOWER(region) = 'north-america';
