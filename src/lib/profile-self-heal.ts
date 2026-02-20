import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Parse arrays safely from auth metadata (handles JSON strings, arrays, and fallback).
 */
export function parseArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.startsWith('[')) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

/**
 * Helper to read a metadata field with camelCase fallback.
 */
function meta(obj: Record<string, any>, snake: string, camel: string, fallback: any = ''): any {
  return obj[snake] || obj[camel] || fallback;
}

/**
 * Build the full profile upsert payload from auth user metadata.
 * This is the single source of truth — used by both use-nuclear-auth and auth/callback.
 */
export function buildProfileFromMetadata(authUser: SupabaseUser) {
  const m = authUser.user_metadata || {};

  return {
    id: authUser.id,
    email: authUser.email || '',
    first_name: meta(m, 'first_name', 'firstName', 'Unknown'),
    last_name: meta(m, 'last_name', 'lastName', 'User'),
    company: meta(m, 'company', 'company', ''),
    buyer_type: meta(m, 'buyer_type', 'buyerType', 'individual'),
    website: meta(m, 'website', 'website', ''),
    linkedin_profile: meta(m, 'linkedin_profile', 'linkedinProfile', ''),
    phone_number: meta(m, 'phone_number', 'phoneNumber', ''),
    job_title: meta(m, 'job_title', 'jobTitle', ''),
    // Array fields
    business_categories: parseArray(m.business_categories || m.businessCategories),
    target_locations: parseArray(m.target_locations || m.targetLocations),
    investment_size: parseArray(m.investment_size || m.investmentSize),
    geographic_focus: parseArray(m.geographic_focus || m.geographicFocus),
    industry_expertise: parseArray(m.industry_expertise || m.industryExpertise),
    integration_plan: parseArray(m.integration_plan || m.integrationPlan),
    equity_source: parseArray(m.equity_source || m.equitySource),
    financing_plan: parseArray(m.financing_plan || m.financingPlan),
    exclusions: parseArray(m.exclusions),
    include_keywords: parseArray(m.include_keywords || m.includeKeywords),
    operating_company_targets: parseArray(m.operating_company_targets || m.operatingCompanyTargets),
    deal_sourcing_methods: parseArray(m.deal_sourcing_methods || m.dealSourcingMethods),
    // Step 3 fields
    referral_source: meta(m, 'referral_source', 'referralSource', null),
    referral_source_detail: meta(m, 'referral_source_detail', 'referralSourceDetail', null),
    target_acquisition_volume: meta(m, 'target_acquisition_volume', 'targetAcquisitionVolume', null),
    // String fields
    ideal_target_description: meta(m, 'ideal_target_description', 'idealTargetDescription', ''),
    revenue_range_min: meta(m, 'revenue_range_min', 'revenueRangeMin', ''),
    revenue_range_max: meta(m, 'revenue_range_max', 'revenueRangeMax', ''),
    specific_business_search: meta(m, 'specific_business_search', 'specificBusinessSearch', ''),
    estimated_revenue: meta(m, 'estimated_revenue', 'estimatedRevenue', ''),
    fund_size: meta(m, 'fund_size', 'fundSize', ''),
    aum: m.aum || '',
    is_funded: meta(m, 'is_funded', 'isFunded', ''),
    funded_by: meta(m, 'funded_by', 'fundedBy', ''),
    target_company_size: meta(m, 'target_company_size', 'targetCompanySize', ''),
    funding_source: meta(m, 'funding_source', 'fundingSource', ''),
    needs_loan: meta(m, 'needs_loan', 'needsLoan', ''),
    ideal_target: meta(m, 'ideal_target', 'idealTarget', ''),
    deploying_capital_now: meta(m, 'deploying_capital_now', 'deployingCapitalNow', ''),
    owning_business_unit: meta(m, 'owning_business_unit', 'owningBusinessUnit', ''),
    deal_size_band: meta(m, 'deal_size_band', 'dealSizeBand', ''),
    corpdev_intent: meta(m, 'corpdev_intent', 'corpdevIntent', ''),
    discretion_type: meta(m, 'discretion_type', 'discretionType', ''),
    committed_equity_band: meta(m, 'committed_equity_band', 'committedEquityBand', ''),
    deployment_timing: meta(m, 'deployment_timing', 'deploymentTiming', ''),
    deal_structure_preference: meta(m, 'deal_structure_preference', 'dealStructurePreference', ''),
    permanent_capital: meta(m, 'permanent_capital', 'permanentCapital', null),
    flex_subxm_ebitda: meta(m, 'flex_subxm_ebitda', 'flexSubxmEbitda', null),
    search_type: meta(m, 'search_type', 'searchType', ''),
    acq_equity_band: meta(m, 'acq_equity_band', 'acqEquityBand', ''),
    search_stage: meta(m, 'search_stage', 'searchStage', ''),
    flex_sub2m_ebitda: meta(m, 'flex_sub2m_ebitda', 'flexSub2mEbitda', null),
    on_behalf_of_buyer: meta(m, 'on_behalf_of_buyer', 'onBehalfOfBuyer', ''),
    buyer_role: meta(m, 'buyer_role', 'buyerRole', ''),
    buyer_org_url: meta(m, 'buyer_org_url', 'buyerOrgUrl', ''),
    owner_timeline: meta(m, 'owner_timeline', 'ownerTimeline', ''),
    owner_intent: meta(m, 'owner_intent', 'ownerIntent', ''),
    uses_bank_finance: meta(m, 'uses_bank_finance', 'usesBankFinance', ''),
    max_equity_today_band: meta(m, 'max_equity_today_band', 'maxEquityTodayBand', ''),
    mandate_blurb: meta(m, 'mandate_blurb', 'mandateBlurb', ''),
    portfolio_company_addon: meta(m, 'portfolio_company_addon', 'portfolioCompanyAddon', ''),
    backers_summary: meta(m, 'backers_summary', 'backersSummary', ''),
    anchor_investors_summary: meta(m, 'anchor_investors_summary', 'anchorInvestorsSummary', ''),
    deal_intent: meta(m, 'deal_intent', 'dealIntent', ''),
    approval_status: 'pending',
    email_verified: !!authUser.email_confirmed_at,
  };
}

/**
 * Self-heal a missing profile by upserting from auth metadata.
 * Returns the created profile data or null on failure.
 * @param selectColumns - optional column list for the returning .select() (default: '*')
 */
export async function selfHealProfile(
  authUser: SupabaseUser,
  selectColumns = '*'
): Promise<any | null> {
  const payload = buildProfileFromMetadata(authUser);

  // Check if the profile already exists to avoid overwriting privileged fields
  // (e.g., approval_status could be 'approved' — self-heal must not reset it to 'pending')
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, approval_status')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingProfile) {
    // Profile exists — preserve approval_status and only fill in missing data
    const { approval_status: _strip, ...safePayload } = payload;
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(safePayload)
      .eq('id', authUser.id)
      .select(selectColumns)
      .single();

    if (updateError) {
      console.error('Self-heal profile update failed:', updateError);
      return null;
    }

    console.log('Self-healed existing profile (approval_status preserved)');
    return updatedProfile;
  }

  // Profile truly missing — insert with pending status
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(selectColumns)
    .single();

  if (insertError) {
    console.error('Self-heal profile creation failed:', insertError);
    return null;
  }

  console.log('Self-healed profile created successfully');
  return newProfile;
}
