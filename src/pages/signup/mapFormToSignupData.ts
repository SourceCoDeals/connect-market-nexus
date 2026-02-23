import { BuyerType, User } from '@/types';
import { processUrl, processLinkedInUrl } from '@/lib/url-utils';
import { parseCurrency } from '@/lib/currency-utils';
import type { SignupFormData } from './types';

export function mapFormToSignupData(formData: SignupFormData): Partial<User> {
  const {
    firstName,
    lastName,
    email,
    company,
    website,
    linkedinProfile,
    phoneNumber,
    buyerType,
    estimatedRevenue,
    fundSize,
    investmentSize,
    aum,
    isFunded,
    fundedBy,
    targetCompanySize,
    fundingSource,
    needsLoan,
    idealTarget,
    idealTargetDescription,
    businessCategories,
    targetLocations,
    revenueRangeMin,
    revenueRangeMax,
    specificBusinessSearch,
    targetDealSizeMin,
    targetDealSizeMax,
    geographicFocus,
    industryExpertise,
    dealStructurePreference,
  } = formData;

  return {
    first_name: firstName,
    last_name: lastName,
    email: email,
    company: company,
    website: processUrl(website),
    linkedin_profile: processLinkedInUrl(linkedinProfile),
    phone_number: phoneNumber,
    buyer_type: buyerType as BuyerType,
    ideal_target_description: idealTargetDescription,
    business_categories: businessCategories,
    target_locations: targetLocations,
    revenue_range_min: revenueRangeMin || undefined,
    revenue_range_max: revenueRangeMax || undefined,
    specific_business_search: specificBusinessSearch,
    // Missing job_title field
    job_title: formData.jobTitle || '',
    // Buyer-specific fields
    estimated_revenue: estimatedRevenue,
    fund_size: fundSize,
    investment_size: investmentSize || [],
    aum: aum,
    is_funded: isFunded,
    funded_by: fundedBy,
    target_company_size: targetCompanySize,
    funding_source: fundingSource,
    needs_loan: needsLoan,
    ideal_target: idealTarget,
    // All new buyer-specific fields from form
    // Private Equity
    deploying_capital_now: formData.deployingCapitalNow || '',
    // Corporate Development
    owning_business_unit: formData.owningBusinessUnit || '',
    deal_size_band: formData.dealSizeBand || '',
    buyer_org_url: formData.buyerOrgUrl ? processUrl(formData.buyerOrgUrl) : '',
    integration_plan: formData.integrationPlan || [],
    corpdev_intent: formData.corpdevIntent || '',
    // Family Office
    discretion_type: formData.discretionType || '',
    // Independent Sponsor
    committed_equity_band: formData.committedEquityBand || '',
    equity_source: formData.equitySource || [],
    deployment_timing: formData.deploymentTiming || '',
    target_deal_size_min: targetDealSizeMin ? parseCurrency(targetDealSizeMin) : undefined,
    target_deal_size_max: targetDealSizeMax ? parseCurrency(targetDealSizeMax) : undefined,
    geographic_focus: geographicFocus ? [geographicFocus] : targetLocations || [],
    industry_expertise: industryExpertise ? [industryExpertise] : [],
    deal_structure_preference: dealStructurePreference || '',
    permanent_capital: formData.permanentCapital || false,
    operating_company_targets: formData.operatingCompanyTargets || [],
    flex_subxm_ebitda: formData.flexSubxmEbitda || false,
    // Search Fund
    search_type: formData.searchType || '',
    acq_equity_band: formData.acqEquityBand || '',
    financing_plan: formData.financingPlan || [],
    search_stage: formData.searchStage || '',
    flex_sub2m_ebitda: formData.flexSub2mEbitda || false,
    // Advisor/Banker
    on_behalf_of_buyer: formData.onBehalfOfBuyer || '',
    buyer_role: formData.buyerRole || '',
    // Business Owner
    owner_timeline: formData.ownerTimeline || '',
    owner_intent: formData.ownerIntent || '',
    // Individual Investor
    uses_bank_finance: formData.usesBank || '',
    max_equity_today_band: formData.maxEquityToday || '',
    // Additional fields from comprehensive form
    mandate_blurb: formData.mandateBlurb || '',
    portfolio_company_addon: formData.portfolioCompanyAddon || '',
    backers_summary: formData.backersSummary || '',
    anchor_investors_summary: formData.anchorInvestorsSummary || '',
    // New Step 4 fields
    deal_intent: formData.dealIntent || '',
    exclusions: formData.exclusions || [],
    include_keywords: formData.includeKeywords || [],
    // Referral source tracking (Step 3)
    referral_source: formData.referralSource || '',
    referral_source_detail: formData.referralSourceDetail || '',
    // Deal sourcing questions (Step 3)
    deal_sourcing_methods: formData.dealSourcingMethods || [],
    target_acquisition_volume: formData.targetAcquisitionVolume || '',
  };
}
