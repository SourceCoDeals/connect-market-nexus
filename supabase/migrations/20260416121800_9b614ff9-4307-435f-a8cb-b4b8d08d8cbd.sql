
-- Backfill auto_shop leads: extract structured fields from raw JSONB
-- Only fills in NULL/empty values to preserve any data already set

UPDATE public.valuation_leads
SET
  -- Core fields from raw_calculator_inputs
  owner_dependency = COALESCE(owner_dependency, raw_calculator_inputs->'owner_dependency'->>'value'),
  growth_trend = COALESCE(growth_trend, raw_calculator_inputs->'trend_24m'->>'value'),
  locations_count = COALESCE(locations_count, (raw_calculator_inputs->'locations_count'->>'value')::integer),
  revenue_model = COALESCE(revenue_model, raw_calculator_inputs->'repeat_revenue_strength'->>'value'),

  -- Valuation results fields
  buyer_lane = COALESCE(buyer_lane, raw_valuation_results->'buyerLane'->>'lane'),
  quality_label = COALESCE(quality_label, raw_valuation_results->'qualityLabel'->>'label'),
  quality_tier = COALESCE(quality_tier, raw_valuation_results->>'tier'),
  readiness_score = COALESCE(readiness_score, (raw_valuation_results->>'readinessScore')::numeric),

  -- Build valuation_insights from positive + negative factors
  valuation_insights = COALESCE(
    NULLIF(valuation_insights::text, 'null')::jsonb,
    CASE
      WHEN raw_valuation_results->'positiveFactors' IS NOT NULL
        OR raw_valuation_results->'negativeFactors' IS NOT NULL
      THEN jsonb_build_object(
        'positiveFactors', COALESCE(raw_valuation_results->'positiveFactors', '[]'::jsonb),
        'negativeFactors', COALESCE(raw_valuation_results->'negativeFactors', '[]'::jsonb),
        'narrative', raw_valuation_results->>'narrative',
        'ebitdaMultipleMid', raw_valuation_results->'ebitdaMultipleMid',
        'revenueMultipleMid', raw_valuation_results->'revenueMultipleMid',
        'scoreBreakdown', raw_valuation_results->'scoreBreakdown'
      )
      ELSE NULL
    END
  ),

  -- Build calculator_specific_data with auto-shop fields
  calculator_specific_data = CASE
    WHEN calculator_specific_data IS NULL OR calculator_specific_data = '{}'::jsonb
    THEN jsonb_build_object(
      'service_type', raw_calculator_inputs->'service_type'->>'value',
      'facility_quality', raw_calculator_inputs->'facility_quality'->>'value',
      'tech_turnover', raw_calculator_inputs->'tech_turnover'->>'value',
      'management_depth', raw_calculator_inputs->'management_depth'->>'value',
      'sop_maturity', raw_calculator_inputs->'sop_maturity'->>'value',
      'financial_cleanliness', raw_calculator_inputs->'financial_cleanliness'->>'value',
      'kpi_quality', raw_calculator_inputs->'kpi_quality'->>'value',
      'customer_concentration', raw_calculator_inputs->'customer_concentration'->>'value',
      'repeat_revenue_strength', raw_calculator_inputs->'repeat_revenue_strength'->>'value',
      'capacity_status', raw_calculator_inputs->'capacity_status'->>'value',
      'environmental_risk', raw_calculator_inputs->'environmental_risk'->>'value',
      'property_quality', raw_calculator_inputs->'property_quality'->>'value',
      'owns_real_estate', raw_calculator_inputs->'owns_real_estate'->>'value',
      'estimated_market_rent_annual', raw_calculator_inputs->'estimated_market_rent_annual'->>'value'
    )
    ELSE calculator_specific_data
  END,

  updated_at = now()

WHERE calculator_type = 'auto_shop'
  AND raw_calculator_inputs IS NOT NULL
  AND raw_calculator_inputs != '{}'::jsonb;
