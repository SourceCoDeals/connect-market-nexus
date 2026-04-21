
CREATE OR REPLACE FUNCTION public.save_extended_profile(p_user_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE profiles SET
    -- Text fields (safe direct assignment)
    ideal_target_description = COALESCE(p_data->>'ideal_target_description', ideal_target_description),
    specific_business_search = COALESCE(p_data->>'specific_business_search', specific_business_search),
    job_title = COALESCE(p_data->>'job_title', job_title),
    estimated_revenue = COALESCE(p_data->>'estimated_revenue', estimated_revenue),
    fund_size = COALESCE(p_data->>'fund_size', fund_size),
    aum = COALESCE(p_data->>'aum', aum),
    is_funded = COALESCE(p_data->>'is_funded', is_funded),
    funded_by = COALESCE(p_data->>'funded_by', funded_by),
    target_company_size = COALESCE(p_data->>'target_company_size', target_company_size),
    funding_source = COALESCE(p_data->>'funding_source', funding_source),
    needs_loan = COALESCE(p_data->>'needs_loan', needs_loan),
    ideal_target = COALESCE(p_data->>'ideal_target', ideal_target),
    deploying_capital_now = COALESCE(p_data->>'deploying_capital_now', deploying_capital_now),
    owning_business_unit = COALESCE(p_data->>'owning_business_unit', owning_business_unit),
    deal_size_band = COALESCE(p_data->>'deal_size_band', deal_size_band),
    corpdev_intent = COALESCE(p_data->>'corpdev_intent', corpdev_intent),
    discretion_type = COALESCE(p_data->>'discretion_type', discretion_type),
    committed_equity_band = COALESCE(p_data->>'committed_equity_band', committed_equity_band),
    deployment_timing = COALESCE(p_data->>'deployment_timing', deployment_timing),
    search_type = COALESCE(p_data->>'search_type', search_type),
    acq_equity_band = COALESCE(p_data->>'acq_equity_band', acq_equity_band),
    search_stage = COALESCE(p_data->>'search_stage', search_stage),
    on_behalf_of_buyer = COALESCE(p_data->>'on_behalf_of_buyer', on_behalf_of_buyer),
    buyer_role = COALESCE(p_data->>'buyer_role', buyer_role),
    buyer_org_url = COALESCE(p_data->>'buyer_org_url', buyer_org_url),
    mandate_blurb = COALESCE(p_data->>'mandate_blurb', mandate_blurb),
    owner_intent = COALESCE(p_data->>'owner_intent', owner_intent),
    owner_timeline = COALESCE(p_data->>'owner_timeline', owner_timeline),
    uses_bank_finance = COALESCE(p_data->>'uses_bank_finance', uses_bank_finance),
    max_equity_today_band = COALESCE(p_data->>'max_equity_today_band', max_equity_today_band),
    portfolio_company_addon = COALESCE(p_data->>'portfolio_company_addon', portfolio_company_addon),
    backers_summary = COALESCE(p_data->>'backers_summary', backers_summary),
    anchor_investors_summary = COALESCE(p_data->>'anchor_investors_summary', anchor_investors_summary),
    deal_intent = COALESCE(p_data->>'deal_intent', deal_intent),
    referral_source = COALESCE(p_data->>'referral_source', referral_source),
    referral_source_detail = COALESCE(p_data->>'referral_source_detail', referral_source_detail),
    target_acquisition_volume = COALESCE(p_data->>'target_acquisition_volume', target_acquisition_volume),

    -- TEXT columns — no ::numeric cast
    revenue_range_min = COALESCE(p_data->>'revenue_range_min', revenue_range_min),
    revenue_range_max = COALESCE(p_data->>'revenue_range_max', revenue_range_max),

    -- Numeric columns — safe cast with NULLIF to handle empty strings
    target_deal_size_min = COALESCE(NULLIF(p_data->>'target_deal_size_min', '')::numeric, target_deal_size_min),
    target_deal_size_max = COALESCE(NULLIF(p_data->>'target_deal_size_max', '')::numeric, target_deal_size_max),

    -- Boolean fields
    permanent_capital = COALESCE((p_data->>'permanent_capital')::boolean, permanent_capital),
    flex_subxm_ebitda = COALESCE((p_data->>'flex_subxm_ebitda')::boolean, flex_subxm_ebitda),
    flex_sub2m_ebitda = COALESCE((p_data->>'flex_sub2m_ebitda')::boolean, flex_sub2m_ebitda),

    -- Array fields: use jsonb array conversion, fallback to existing value
    business_categories = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'business_categories') AS x),
      business_categories
    ),
    target_locations = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'target_locations') AS x),
      target_locations
    ),
    geographic_focus = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'geographic_focus') AS x),
      geographic_focus
    ),
    investment_size = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'investment_size') AS x),
      investment_size
    ),
    integration_plan = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'integration_plan') AS x),
      integration_plan
    ),
    equity_source = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'equity_source') AS x),
      equity_source
    ),
    financing_plan = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'financing_plan') AS x),
      financing_plan
    ),
    operating_company_targets = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'operating_company_targets') AS x),
      operating_company_targets
    ),
    exclusions = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'exclusions') AS x),
      exclusions
    ),
    include_keywords = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'include_keywords') AS x),
      include_keywords
    ),
    deal_sourcing_methods = COALESCE(
      (SELECT array_agg(x) FROM jsonb_array_elements_text(p_data->'deal_sourcing_methods') AS x),
      deal_sourcing_methods
    )
  WHERE id = p_user_id;

EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't crash — partial data is better than no data
  RAISE WARNING 'save_extended_profile failed for user %: %', p_user_id, SQLERRM;
END;
$$;

-- Ensure grants are correct
GRANT EXECUTE ON FUNCTION public.save_extended_profile(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.save_extended_profile(uuid, jsonb) TO authenticated;
