
-- Fix revenue_model for 3 backfilled leads from CSV data
UPDATE valuation_leads SET revenue_model = 'transactional' WHERE id = 'eacb9083-fd06-4942-bcea-4f44562f75b9' AND revenue_model IS NULL;
UPDATE valuation_leads SET revenue_model = 'recurring' WHERE id = 'e1a180f6-7e6f-41b5-a55f-6e77ec98e3f9' AND revenue_model IS NULL;
UPDATE valuation_leads SET revenue_model = 'both' WHERE id = '2cb9d31a-6289-4cef-9331-085a215e27de' AND revenue_model IS NULL;

-- Populate cta_clicked from tags JSONB for all leads where it's null but tags has the data
UPDATE valuation_leads 
SET cta_clicked = COALESCE((tags->>'cta_clicked')::boolean, false)
WHERE cta_clicked IS NULL AND tags IS NOT NULL AND tags ? 'cta_clicked';

-- Populate revenue_model from raw_calculator_inputs for any leads still missing it
UPDATE valuation_leads
SET revenue_model = raw_calculator_inputs->'businessModel'->>'value'
WHERE revenue_model IS NULL 
  AND raw_calculator_inputs IS NOT NULL 
  AND raw_calculator_inputs->'businessModel'->>'value' IS NOT NULL;
