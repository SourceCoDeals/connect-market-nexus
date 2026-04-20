
-- Backfill all JSONB sections from incoming_leads raw_body into valuation_leads
-- This fixes the COALESCE issue where empty {} objects blocked new data
UPDATE valuation_leads vl
SET
  financial_details = COALESCE(
    (il.raw_body->'financial_details')::jsonb,
    vl.financial_details
  ),
  readiness_drivers = COALESCE(
    (il.raw_body->'readiness_drivers')::jsonb,
    vl.readiness_drivers
  ),
  exit_intent_details = COALESCE(
    (il.raw_body->'exit_intent')::jsonb,
    vl.exit_intent_details
  ),
  tags = COALESCE(
    (il.raw_body->'tags')::jsonb,
    vl.tags
  ),
  session_metadata = COALESCE(
    (il.raw_body->'session_metadata')::jsonb,
    vl.session_metadata
  ),
  -- Overwrite empty {} raw_calculator_inputs with actual data
  raw_calculator_inputs = CASE
    WHEN vl.raw_calculator_inputs IS NULL OR vl.raw_calculator_inputs = '{}'::jsonb
    THEN COALESCE((il.raw_body->'calculator_inputs')::jsonb, vl.raw_calculator_inputs)
    ELSE vl.raw_calculator_inputs
  END,
  -- Overwrite empty {} raw_valuation_results with actual data  
  raw_valuation_results = CASE
    WHEN vl.raw_valuation_results IS NULL OR vl.raw_valuation_results = '{}'::jsonb
    THEN COALESCE((il.raw_body->'valuation_result')::jsonb, vl.raw_valuation_results)
    ELSE vl.raw_valuation_results
  END,
  -- Also fill in flattened fields that may have been missed
  gross_margin = COALESCE(
    vl.gross_margin,
    ((il.raw_body->'business_profile'->>'grossMargin')::numeric)
  ),
  prev_revenue = COALESCE(
    vl.prev_revenue,
    ((il.raw_body->'business_profile'->>'prevRevenue')::numeric)
  ),
  years_in_business = COALESCE(
    vl.years_in_business,
    (il.raw_body->'business_profile'->>'yearsInBusiness')
  ),
  owned_assets = COALESCE(
    vl.owned_assets,
    ((il.raw_body->'business_profile'->>'ownedAssets')::numeric)
  ),
  custom_industry = COALESCE(
    vl.custom_industry,
    (il.raw_body->'business_profile'->>'customIndustry')
  ),
  exit_structure = COALESCE(
    vl.exit_structure,
    (il.raw_body->'exit_intent'->>'structure')
  ),
  exit_involvement = COALESCE(
    vl.exit_involvement,
    (il.raw_body->'exit_intent'->>'involvement')
  ),
  buyer_intro_phone = COALESCE(
    vl.buyer_intro_phone,
    (il.raw_body->'exit_intent'->>'buyerIntroPhone')
  ),
  buyer_intro_email = COALESCE(
    vl.buyer_intro_email,
    (il.raw_body->'exit_intent'->>'buyerIntroEmail')
  ),
  exit_timing = COALESCE(
    vl.exit_timing,
    (il.raw_body->'exit_intent'->>'timeline')
  ),
  open_to_intros = COALESCE(
    vl.open_to_intros,
    ((il.raw_body->'exit_intent'->>'openToBuyer')::boolean)
  ),
  marketing_opt_in = COALESCE(
    vl.marketing_opt_in,
    ((il.raw_body->>'marketing_opt_in')::boolean)
  ),
  calculator_session_id = COALESCE(
    vl.calculator_session_id,
    (il.raw_body->>'session_id')
  ),
  readiness_score = COALESCE(
    vl.readiness_score,
    ((il.raw_body->'calculated_results'->>'readinessScore')::numeric)
  ),
  updated_at = now()
FROM incoming_leads il
WHERE lower(vl.email) = lower(il.email)
  AND vl.calculator_type = 'general'
  AND vl.excluded = false
  AND il.raw_body IS NOT NULL
  AND il.raw_body != '{}'::jsonb;
