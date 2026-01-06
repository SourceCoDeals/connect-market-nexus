
import { User, ApprovalStatus, BuyerType } from "@/types";

// Extended User type with data quality flag
export interface UserWithDataIssues extends User {
  _hasDataIssues?: boolean;
  _dataIssues?: string[];
}

/**
 * Safely parse JSON, returning fallback on failure
 */
function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Safely convert to array, handling various input types
 */
function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    if (value === '') return [];
    // Try JSON parse first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall back to treating as comma-separated
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Creates a User object from profile data.
 * NEVER THROWS - always returns a valid User object.
 * Sets _hasDataIssues flag if data was malformed.
 */
export function createUserObject(profile: any): UserWithDataIssues {
  const issues: string[] = [];
  
  // Handle completely invalid input - return minimal user
  if (!profile) {
    console.warn('⚠️ createUserObject received null/undefined profile, returning minimal user');
    return createMinimalUser('unknown-' + Date.now(), '', issues.concat(['Profile was null/undefined']));
  }
  
  if (!profile.id) {
    console.warn('⚠️ createUserObject received profile without ID:', profile);
    return createMinimalUser('unknown-' + Date.now(), profile.email || '', issues.concat(['Profile missing ID']));
  }

  // Track any parsing issues
  let businessCategories: string[] = [];
  try {
    businessCategories = safeArray(profile.business_categories);
  } catch (e) {
    issues.push('Failed to parse business_categories');
    businessCategories = [];
  }

  let dealSourcingMethods: string[] = [];
  try {
    dealSourcingMethods = safeArray(profile.deal_sourcing_methods);
  } catch (e) {
    issues.push('Failed to parse deal_sourcing_methods');
    dealSourcingMethods = [];
  }

  const user: UserWithDataIssues = {
    id: profile.id,
    email: profile.email || '',
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    company: profile.company || profile.company_name || '',
    website: profile.website || '',
    phone_number: profile.phone_number || '',
    role: 'buyer' as const,
    email_verified: Boolean(profile.email_verified === true),
    approval_status: (profile.approval_status || 'pending') as ApprovalStatus,
    is_admin: Boolean(profile.is_admin === true),
    buyer_type: (profile.buyer_type || 'corporate') as BuyerType,
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
    company_name: profile.company_name || profile.company || '',
    estimated_revenue: profile.estimated_revenue || '',
    fund_size: profile.fund_size || '',
    investment_size: safeArray(profile.investment_size),
    aum: profile.aum || '',
    is_funded: profile.is_funded || '',
    funded_by: profile.funded_by || '',
    target_company_size: profile.target_company_size || '',
    funding_source: profile.funding_source || '',
    needs_loan: profile.needs_loan || '',
    ideal_target: profile.ideal_target || '',
    bio: profile.bio || '',
    linkedin_profile: profile.linkedin_profile || '',
    ideal_target_description: profile.ideal_target_description || '',
    business_categories: businessCategories,
    target_locations: safeArray(profile.target_locations),
    revenue_range_min: profile.revenue_range_min || null,
    revenue_range_max: profile.revenue_range_max || null,
    specific_business_search: profile.specific_business_search || '',
    onboarding_completed: Boolean(profile.onboarding_completed),
    job_title: profile.job_title || '',
    
    // Fee agreement tracking fields
    fee_agreement_signed: Boolean(profile.fee_agreement_signed),
    fee_agreement_signed_at: profile.fee_agreement_signed_at || null,
    fee_agreement_email_sent: Boolean(profile.fee_agreement_email_sent),
    fee_agreement_email_sent_at: profile.fee_agreement_email_sent_at || null,
    
    // NDA tracking fields
    nda_signed: Boolean(profile.nda_signed),
    nda_signed_at: profile.nda_signed_at || null,
    nda_email_sent: Boolean(profile.nda_email_sent),
    nda_email_sent_at: profile.nda_email_sent_at || null,
    
    // All comprehensive buyer-specific fields
    // Private Equity
    deploying_capital_now: profile.deploying_capital_now || '',
    // Corporate Development
    owning_business_unit: profile.owning_business_unit || '',
    deal_size_band: profile.deal_size_band || '',
    buyer_org_url: profile.buyer_org_url || '',
    integration_plan: safeArray(profile.integration_plan),
    corpdev_intent: profile.corpdev_intent || '',
    // Family Office
    discretion_type: profile.discretion_type || '',
    // Independent Sponsor
    committed_equity_band: profile.committed_equity_band || '',
    equity_source: safeArray(profile.equity_source),
    deployment_timing: profile.deployment_timing || '',
    target_deal_size_min: profile.target_deal_size_min || null,
    target_deal_size_max: profile.target_deal_size_max || null,
    geographic_focus: safeArray(profile.geographic_focus),
    industry_expertise: safeArray(profile.industry_expertise),
    deal_structure_preference: profile.deal_structure_preference || '',
    permanent_capital: profile.permanent_capital || null,
    operating_company_targets: safeArray(profile.operating_company_targets),
    flex_subxm_ebitda: profile.flex_subxm_ebitda ?? null,
    flex_subXm_ebitda: profile.flex_subxm_ebitda ?? null,
    // Search Fund
    search_type: profile.search_type || '',
    acq_equity_band: profile.acq_equity_band || '',
    financing_plan: safeArray(profile.financing_plan),
    search_stage: profile.search_stage || '',
    flex_sub2m_ebitda: profile.flex_sub2m_ebitda || null,
    // Advisor/Banker
    on_behalf_of_buyer: profile.on_behalf_of_buyer || '',
    buyer_role: profile.buyer_role || '',
    // Business Owner
    owner_timeline: profile.owner_timeline || '',
    owner_intent: profile.owner_intent || '',
    // Individual Investor
    uses_bank_finance: profile.uses_bank_finance || '',
    max_equity_today_band: profile.max_equity_today_band || '',
    // Additional comprehensive fields
    mandate_blurb: profile.mandate_blurb || '',
    portfolio_company_addon: profile.portfolio_company_addon || '',
    backers_summary: profile.backers_summary || '',
    anchor_investors_summary: profile.anchor_investors_summary || '',
    
    // Missing fields that weren't being mapped
    deal_intent: profile.deal_intent || '',
    exclusions: safeArray(profile.exclusions),
    include_keywords: safeArray(profile.include_keywords),
    
    // Referral source tracking (Step 3)
    referral_source: profile.referral_source || null,
    referral_source_detail: profile.referral_source_detail || null,
    
    // Deal sourcing questions (Step 3)
    deal_sourcing_methods: dealSourcingMethods,
    target_acquisition_volume: profile.target_acquisition_volume || null,
    
    // Data quality flags
    _hasDataIssues: issues.length > 0,
    _dataIssues: issues.length > 0 ? issues : undefined,
    
    get firstName() { return this.first_name; },
    get lastName() { return this.last_name; },
    get phoneNumber() { return this.phone_number; },
    get isAdmin() { return this.is_admin; },
    get buyerType() { return this.buyer_type; },
    get emailVerified() { return this.email_verified; },
    get isApproved() { return this.approval_status === 'approved'; },
    get createdAt() { return this.created_at; },
    get updatedAt() { return this.updated_at; },
  };
  
  if (issues.length > 0) {
    console.warn(`⚠️ User ${profile.id} has data issues:`, issues);
  }
  
  return user;
}

/**
 * Creates a minimal valid User object for error cases
 */
function createMinimalUser(id: string, email: string, issues: string[]): UserWithDataIssues {
  return {
    id,
    email,
    first_name: '',
    last_name: '',
    company: '',
    website: '',
    phone_number: '',
    role: 'buyer' as const,
    email_verified: false,
    approval_status: 'pending' as ApprovalStatus,
    is_admin: false,
    buyer_type: 'individual' as BuyerType,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _hasDataIssues: true,
    _dataIssues: issues,
    get firstName() { return this.first_name; },
    get lastName() { return this.last_name; },
    get phoneNumber() { return this.phone_number; },
    get isAdmin() { return this.is_admin; },
    get buyerType() { return this.buyer_type; },
    get emailVerified() { return this.email_verified; },
    get isApproved() { return this.approval_status === 'approved'; },
    get createdAt() { return this.created_at; },
    get updatedAt() { return this.updated_at; },
  };
}

export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  return user.is_admin === true;
}

export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Unknown User';
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) return user.first_name;
  if (user.last_name) return user.last_name;
  return user.email || 'Unknown User';
}

export function getUserInitials(user: User | null): string {
  if (!user) return 'U';
  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
}

export function validateUserData(user: User): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!user.id) errors.push('User ID is required');
  if (!user.email) errors.push('Email is required');
  if (!user.first_name) errors.push('First name is required');
  if (!user.last_name) errors.push('Last name is required');
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (user.email && !emailRegex.test(user.email)) {
    errors.push('Invalid email format');
  }
  
  const validStatuses: ApprovalStatus[] = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(user.approval_status)) {
    errors.push('Invalid approval status');
  }
  
  const validBuyerTypes: BuyerType[] = ['corporate', 'privateEquity', 'familyOffice', 'searchFund', 'individual', 'independentSponsor', 'advisor', 'businessOwner'];
  if (!validBuyerTypes.includes(user.buyer_type)) {
    errors.push('Invalid buyer type');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Nuclear simplification: Remove all localStorage cleanup functions
// Let Supabase handle all session management
export async function cleanupAuthState(): Promise<void> {
  console.log('🧹 Nuclear auth cleanup - letting Supabase handle everything');
}
