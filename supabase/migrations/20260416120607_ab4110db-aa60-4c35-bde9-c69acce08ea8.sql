-- Backfill readiness_score from raw_valuation_results for leads that have it
UPDATE valuation_leads
SET readiness_score = (raw_valuation_results->>'readinessScore')::numeric,
    updated_at = now()
WHERE readiness_score IS NULL
  AND raw_valuation_results->>'readinessScore' IS NOT NULL;