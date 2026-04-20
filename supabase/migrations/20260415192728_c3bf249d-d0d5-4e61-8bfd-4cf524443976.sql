CREATE OR REPLACE FUNCTION public.save_extended_profile(p_user_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET
    ideal_target_description = COALESCE(p_data->>'ideal_target_description', ideal_target_description),
    business_categories = CASE WHEN p_data ? 'business_categories' THEN p_data->'business_categories' ELSE business_categories END,
    target_locations = CASE WHEN p_data ? 'target_locations' THEN p_data->'target_locations' ELSE target_locations END,
    revenue_range_min = COALESCE(p_data->>'revenue_range_min', revenue_range_min),
    revenue_range_max = COALESCE(p_data->>'revenue_range_max', revenue_range_max),
    specific_business_search = COALESCE(p_data->>'specific_business_search', specific_business_search),
    target_deal_size_min = COALESCE(NULLIF(p_data->>'target_deal_size_min', '')::numeric, target_deal_size_min),
    target_deal_size_max = COALESCE(NULLIF(p_data->>'target_deal_size_max', '')::numeric, target_deal_size_max),
    estimated_revenue = COALESCE(p_data->>'estimated_revenue', estimated_revenue),
    fund_size = COALESCE(p_data->>'fund_size', fund_size),
    investment_size = CASE WHEN p_data ? 'investment_size' THEN p_data->'investment_size' ELSE investment_size END,
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
    buyer_org_url = COALESCE(p_data->>'buyer_org_url', buyer_org_url),
    integration_plan = CASE WHEN p_data ? 'integration_plan' THEN p_data->'integration_plan' ELSE integration_plan END,
    corpdev_intent = COALESCE(p_data->>'corpdev_intent', corpdev_intent),
    discretion_type = COALESCE(p_data->>'discretion_type', discretion_type),
    committed_equity_band = COALESCE(p_data->>'committed_equity_band', committed_equity_band),
    equity_source = CASE WHEN p_data ? 'equity_source' THEN p_data->'equity_source' ELSE equity_source END,
    deployment_timing = COALESCE(p_data->>'deployment_timing', deployment_timing),
    geographic_focus = CASE WHEN p_data ? 'geographic_focus' THEN p_data->'geographic_focus' ELSE geographic_focus END,
    industry_expertise = CASE WHEN p_data ? 'industry_expertise' THEN p_data->'industry_expertise' ELSE industry_expertise END,
    deal_structure_preference = COALESCE(p_data->>'deal_structure_preference', deal_structure_preference),
    permanent_capital = COALESCE((p_data->>'permanent_capital')::boolean, permanent_capital),
    operating_company_targets = CASE WHEN p_data ? 'operating_company_targets' THEN p_data->'operating_company_targets' ELSE operating_company_targets END,
    flex_subxm_ebitda = COALESCE((p_data->>'flex_subxm_ebitda')::boolean, flex_subxm_ebitda),
    search_type = COALESCE(p_data->>'search_type', search_type),
    acq_equity_band = COALESCE(p_data->>'acq_equity_band', acq_equity_band),
    financing_plan = CASE WHEN p_data ? 'financing_plan' THEN p_data->'financing_plan' ELSE financing_plan END,
    search_stage = COALESCE(p_data->>'search_stage', search_stage),
    flex_sub2m_ebitda = COALESCE((p_data->>'flex_sub2m_ebitda')::boolean, flex_sub2m_ebitda),
    on_behalf_of_buyer = COALESCE(p_data->>'on_behalf_of_buyer', on_behalf_of_buyer),
    buyer_role = COALESCE(p_data->>'buyer_role', buyer_role),
    owner_timeline = COALESCE(p_data->>'owner_timeline', owner_timeline),
    owner_intent = COALESCE(p_data->>'owner_intent', owner_intent),
    uses_bank_finance = COALESCE(p_data->>'uses_bank_finance', uses_bank_finance),
    max_equity_today_band = COALESCE(p_data->>'max_equity_today_band', max_equity_today_band),
    mandate_blurb = COALESCE(p_data->>'mandate_blurb', mandate_blurb),
    portfolio_company_addon = COALESCE(p_data->>'portfolio_company_addon', portfolio_company_addon),
    backers_summary = COALESCE(p_data->>'backers_summary', backers_summary),
    anchor_investors_summary = COALESCE(p_data->>'anchor_investors_summary', anchor_investors_summary),
    deal_intent = COALESCE(p_data->>'deal_intent', deal_intent),
    exclusions = CASE WHEN p_data ? 'exclusions' THEN p_data->'exclusions' ELSE exclusions END,
    include_keywords = CASE WHEN p_data ? 'include_keywords' THEN p_data->'include_keywords' ELSE include_keywords END,
    referral_source = COALESCE(p_data->>'referral_source', referral_source),
    referral_source_detail = COALESCE(p_data->>'referral_source_detail', referral_source_detail),
    deal_sourcing_methods = CASE WHEN p_data ? 'deal_sourcing_methods' THEN p_data->'deal_sourcing_methods' ELSE deal_sourcing_methods END,
    target_acquisition_volume = COALESCE(p_data->>'target_acquisition_volume', target_acquisition_volume),
    updated_at = now()
  WHERE id = p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'save_extended_profile failed for user %: %', p_user_id, SQLERRM;
END;
$$;