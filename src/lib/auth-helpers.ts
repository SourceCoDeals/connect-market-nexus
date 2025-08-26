
import { User, ApprovalStatus, BuyerType } from "@/types";

export function createUserObject(profile: any): User {
  if (!profile || !profile.id) {
    console.warn('❌ Invalid profile data received:', profile);
    throw new Error('Invalid profile data: missing required fields');
  }

  try {
    const user: User = {
      id: profile.id,
      email: profile.email || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      company: profile.company || '',
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
      investment_size: Array.isArray(profile.investment_size) ? profile.investment_size : (profile.investment_size ? [profile.investment_size] : []),
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
      business_categories: Array.isArray(profile.business_categories) 
        ? profile.business_categories 
        : typeof profile.business_categories === 'string' 
          ? JSON.parse(profile.business_categories || '[]')
          : [],
      target_locations: Array.isArray(profile.target_locations)
        ? profile.target_locations
        : typeof profile.target_locations === 'string'
          ? profile.target_locations === '' ? [] : [profile.target_locations]
          : [],
      revenue_range_min: profile.revenue_range_min || null,
      revenue_range_max: profile.revenue_range_max || null,
      specific_business_search: profile.specific_business_search || '',
      onboarding_completed: Boolean(profile.onboarding_completed),
      // Missing job_title field
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
      integration_plan: Array.isArray(profile.integration_plan) ? profile.integration_plan : [],
      corpdev_intent: profile.corpdev_intent || '',
      // Family Office
      discretion_type: profile.discretion_type || '',
      // Independent Sponsor
      committed_equity_band: profile.committed_equity_band || '',
      equity_source: Array.isArray(profile.equity_source) ? profile.equity_source : [],
      deployment_timing: profile.deployment_timing || '',
      target_deal_size_min: profile.target_deal_size_min || null,
      target_deal_size_max: profile.target_deal_size_max || null,
      geographic_focus: Array.isArray(profile.geographic_focus) 
        ? profile.geographic_focus 
        : typeof profile.geographic_focus === 'string'
          ? profile.geographic_focus === '' ? [] : [profile.geographic_focus]
          : [],
      industry_expertise: Array.isArray(profile.industry_expertise)
        ? profile.industry_expertise
        : typeof profile.industry_expertise === 'string'
          ? profile.industry_expertise === '' ? [] : [profile.industry_expertise]
          : [],
      deal_structure_preference: profile.deal_structure_preference || '',
      permanent_capital: profile.permanent_capital || null,
      operating_company_targets: Array.isArray(profile.operating_company_targets) ? profile.operating_company_targets : [],
      // Aliasing for both property names; database column is flex_subxm_ebitda
      flex_subxm_ebitda: profile.flex_subxm_ebitda ?? null,
      flex_subXm_ebitda: profile.flex_subxm_ebitda ?? null,
      // Search Fund
      search_type: profile.search_type || '',
      acq_equity_band: profile.acq_equity_band || '',
      financing_plan: Array.isArray(profile.financing_plan) ? profile.financing_plan : [],
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
    
    return user;
  } catch (error) {
    console.error('❌ Error creating user object:', error, 'Profile:', profile);
    throw new Error(`Failed to create user object: ${error.message}`);
  }
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
