
-- ═══ 1. Add new columns ═══
ALTER TABLE public.valuation_leads
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS calculator_session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_location TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gross_margin NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prev_revenue NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS years_in_business TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS owned_assets NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_industry TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_structure TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_involvement TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_intro_phone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_intro_email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS financial_details JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS readiness_drivers JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exit_intent_details JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valuation_insights JSONB DEFAULT NULL;

-- ═══ 2. Replace merge_valuation_lead RPC with expanded version ═══
CREATE OR REPLACE FUNCTION public.merge_valuation_lead(
  p_calculator_type TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_website TEXT DEFAULT NULL,
  p_business_name TEXT DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_revenue NUMERIC DEFAULT NULL,
  p_ebitda NUMERIC DEFAULT NULL,
  p_valuation_low NUMERIC DEFAULT NULL,
  p_valuation_mid NUMERIC DEFAULT NULL,
  p_valuation_high NUMERIC DEFAULT NULL,
  p_quality_tier TEXT DEFAULT NULL,
  p_quality_label TEXT DEFAULT NULL,
  p_buyer_lane TEXT DEFAULT NULL,
  p_growth_trend TEXT DEFAULT NULL,
  p_owner_dependency TEXT DEFAULT NULL,
  p_locations_count INT DEFAULT NULL,
  p_lead_source TEXT DEFAULT NULL,
  p_source_submission_id TEXT DEFAULT NULL,
  p_raw_calculator_inputs JSONB DEFAULT NULL,
  p_raw_valuation_results JSONB DEFAULT NULL,
  p_calculator_specific_data JSONB DEFAULT NULL,
  p_exit_timing TEXT DEFAULT NULL,
  p_open_to_intros BOOLEAN DEFAULT NULL,
  -- New parameters for complete payload
  p_marketing_opt_in BOOLEAN DEFAULT NULL,
  p_calculator_session_id TEXT DEFAULT NULL,
  p_user_location TEXT DEFAULT NULL,
  p_gross_margin NUMERIC DEFAULT NULL,
  p_prev_revenue NUMERIC DEFAULT NULL,
  p_years_in_business TEXT DEFAULT NULL,
  p_owned_assets NUMERIC DEFAULT NULL,
  p_custom_industry TEXT DEFAULT NULL,
  p_exit_structure TEXT DEFAULT NULL,
  p_exit_involvement TEXT DEFAULT NULL,
  p_buyer_intro_phone TEXT DEFAULT NULL,
  p_buyer_intro_email TEXT DEFAULT NULL,
  p_financial_details JSONB DEFAULT NULL,
  p_readiness_drivers JSONB DEFAULT NULL,
  p_exit_intent_details JSONB DEFAULT NULL,
  p_tags JSONB DEFAULT NULL,
  p_session_metadata JSONB DEFAULT NULL,
  p_valuation_insights JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO valuation_leads (
    calculator_type, full_name, email, website, business_name,
    industry, region, location, revenue, ebitda,
    valuation_low, valuation_mid, valuation_high,
    quality_tier, quality_label, buyer_lane,
    growth_trend, owner_dependency, locations_count,
    lead_source, source_submission_id,
    raw_calculator_inputs, raw_valuation_results, calculator_specific_data,
    exit_timing, open_to_intros,
    marketing_opt_in, calculator_session_id, user_location,
    gross_margin, prev_revenue, years_in_business, owned_assets, custom_industry,
    exit_structure, exit_involvement, buyer_intro_phone, buyer_intro_email,
    financial_details, readiness_drivers, exit_intent_details,
    tags, session_metadata, valuation_insights,
    submission_count, updated_at
  ) VALUES (
    p_calculator_type, p_full_name, p_email, p_website, p_business_name,
    p_industry, p_region, p_location, p_revenue, p_ebitda,
    p_valuation_low, p_valuation_mid, p_valuation_high,
    p_quality_tier, p_quality_label, p_buyer_lane,
    p_growth_trend, p_owner_dependency, p_locations_count,
    p_lead_source, p_source_submission_id,
    p_raw_calculator_inputs, p_raw_valuation_results, p_calculator_specific_data,
    p_exit_timing, p_open_to_intros,
    p_marketing_opt_in, p_calculator_session_id, p_user_location,
    p_gross_margin, p_prev_revenue, p_years_in_business, p_owned_assets, p_custom_industry,
    p_exit_structure, p_exit_involvement, p_buyer_intro_phone, p_buyer_intro_email,
    p_financial_details, p_readiness_drivers, p_exit_intent_details,
    p_tags, p_session_metadata, p_valuation_insights,
    1, now()
  )
  ON CONFLICT (email, calculator_type) WHERE excluded = false AND email IS NOT NULL
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    website = COALESCE(EXCLUDED.website, valuation_leads.website),
    business_name = COALESCE(EXCLUDED.business_name, valuation_leads.business_name),
    industry = COALESCE(EXCLUDED.industry, valuation_leads.industry),
    region = COALESCE(EXCLUDED.region, valuation_leads.region),
    location = COALESCE(EXCLUDED.location, valuation_leads.location),
    revenue = COALESCE(EXCLUDED.revenue, valuation_leads.revenue),
    ebitda = COALESCE(EXCLUDED.ebitda, valuation_leads.ebitda),
    valuation_low = COALESCE(EXCLUDED.valuation_low, valuation_leads.valuation_low),
    valuation_mid = COALESCE(EXCLUDED.valuation_mid, valuation_leads.valuation_mid),
    valuation_high = COALESCE(EXCLUDED.valuation_high, valuation_leads.valuation_high),
    quality_tier = COALESCE(EXCLUDED.quality_tier, valuation_leads.quality_tier),
    quality_label = COALESCE(EXCLUDED.quality_label, valuation_leads.quality_label),
    buyer_lane = COALESCE(EXCLUDED.buyer_lane, valuation_leads.buyer_lane),
    growth_trend = COALESCE(EXCLUDED.growth_trend, valuation_leads.growth_trend),
    owner_dependency = COALESCE(EXCLUDED.owner_dependency, valuation_leads.owner_dependency),
    locations_count = COALESCE(EXCLUDED.locations_count, valuation_leads.locations_count),
    exit_timing = COALESCE(EXCLUDED.exit_timing, valuation_leads.exit_timing),
    open_to_intros = COALESCE(EXCLUDED.open_to_intros, valuation_leads.open_to_intros),
    lead_source = CASE 
      WHEN EXCLUDED.lead_source = 'full_report' AND valuation_leads.lead_source = 'initial_unlock' 
      THEN 'full_report'
      ELSE COALESCE(EXCLUDED.lead_source, valuation_leads.lead_source)
    END,
    initial_unlock_at = CASE
      WHEN EXCLUDED.lead_source = 'full_report' AND valuation_leads.lead_source = 'initial_unlock'
      THEN valuation_leads.created_at
      ELSE valuation_leads.initial_unlock_at
    END,
    submission_count = valuation_leads.submission_count + 1,
    raw_calculator_inputs = COALESCE(EXCLUDED.raw_calculator_inputs, valuation_leads.raw_calculator_inputs),
    raw_valuation_results = COALESCE(EXCLUDED.raw_valuation_results, valuation_leads.raw_valuation_results),
    calculator_specific_data = COALESCE(EXCLUDED.calculator_specific_data, valuation_leads.calculator_specific_data),
    source_submission_id = COALESCE(EXCLUDED.source_submission_id, valuation_leads.source_submission_id),
    -- New fields
    marketing_opt_in = COALESCE(EXCLUDED.marketing_opt_in, valuation_leads.marketing_opt_in),
    calculator_session_id = COALESCE(EXCLUDED.calculator_session_id, valuation_leads.calculator_session_id),
    user_location = COALESCE(EXCLUDED.user_location, valuation_leads.user_location),
    gross_margin = COALESCE(EXCLUDED.gross_margin, valuation_leads.gross_margin),
    prev_revenue = COALESCE(EXCLUDED.prev_revenue, valuation_leads.prev_revenue),
    years_in_business = COALESCE(EXCLUDED.years_in_business, valuation_leads.years_in_business),
    owned_assets = COALESCE(EXCLUDED.owned_assets, valuation_leads.owned_assets),
    custom_industry = COALESCE(EXCLUDED.custom_industry, valuation_leads.custom_industry),
    exit_structure = COALESCE(EXCLUDED.exit_structure, valuation_leads.exit_structure),
    exit_involvement = COALESCE(EXCLUDED.exit_involvement, valuation_leads.exit_involvement),
    buyer_intro_phone = COALESCE(EXCLUDED.buyer_intro_phone, valuation_leads.buyer_intro_phone),
    buyer_intro_email = COALESCE(EXCLUDED.buyer_intro_email, valuation_leads.buyer_intro_email),
    financial_details = COALESCE(EXCLUDED.financial_details, valuation_leads.financial_details),
    readiness_drivers = COALESCE(EXCLUDED.readiness_drivers, valuation_leads.readiness_drivers),
    exit_intent_details = COALESCE(EXCLUDED.exit_intent_details, valuation_leads.exit_intent_details),
    tags = COALESCE(EXCLUDED.tags, valuation_leads.tags),
    session_metadata = COALESCE(EXCLUDED.session_metadata, valuation_leads.session_metadata),
    valuation_insights = COALESCE(EXCLUDED.valuation_insights, valuation_leads.valuation_insights),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
