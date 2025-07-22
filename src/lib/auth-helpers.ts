
import { User, ApprovalStatus, BuyerType } from "@/types";

export function createUserObject(profileData: any): User {
  // Simple type conversions without complex validation
  const approval_status: ApprovalStatus = ['pending', 'approved', 'rejected'].includes(profileData.approval_status) 
    ? profileData.approval_status 
    : 'pending';
    
  const buyer_type: BuyerType = ['corporate', 'individual', 'family_office', 'private_equity', 'search_fund'].includes(profileData.buyer_type)
    ? profileData.buyer_type
    : 'corporate';

  // Handle business_categories - simple parsing
  let business_categories: string[] = [];
  try {
    if (typeof profileData.business_categories === 'string') {
      business_categories = JSON.parse(profileData.business_categories);
    } else if (Array.isArray(profileData.business_categories)) {
      business_categories = profileData.business_categories;
    }
  } catch {
    business_categories = [];
  }

  return {
    id: profileData.id,
    email: profileData.email || '',
    first_name: profileData.first_name || '',
    last_name: profileData.last_name || '',
    company: profileData.company || '',
    website: profileData.website || '',
    phone_number: profileData.phone_number || '',
    role: 'buyer' as const,
    email_verified: Boolean(profileData.email_verified),
    approval_status,
    is_admin: Boolean(profileData.is_admin),
    buyer_type,
    created_at: profileData.created_at,
    updated_at: profileData.updated_at,
    company_name: profileData.company_name || '',
    estimated_revenue: profileData.estimated_revenue || '',
    fund_size: profileData.fund_size || '',
    investment_size: profileData.investment_size || '',
    aum: profileData.aum || '',
    is_funded: profileData.is_funded || '',
    funded_by: profileData.funded_by || '',
    target_company_size: profileData.target_company_size || '',
    funding_source: profileData.funding_source || '',
    needs_loan: profileData.needs_loan || '',
    ideal_target: profileData.ideal_target || '',
    bio: profileData.bio || '',
    linkedin_profile: profileData.linkedin_profile || '',
    ideal_target_description: profileData.ideal_target_description || '',
    business_categories,
    target_locations: profileData.target_locations || '',
    revenue_range_min: profileData.revenue_range_min,
    revenue_range_max: profileData.revenue_range_max,
    specific_business_search: profileData.specific_business_search || '',
    
    // Computed properties (simple getters)
    get firstName() { return this.first_name; },
    get lastName() { return this.last_name; },
    get phoneNumber() { return this.phone_number; },
    get isAdmin() { return this.is_admin; },
    get buyerType() { return this.buyer_type; },
    get emailVerified() { return this.email_verified; },
    get isApproved() { return this.approval_status === 'approved'; },
    get createdAt() { return this.created_at; },
    get updatedAt() { return this.updated_at; }
  };
}

// Simple cleanup - no complex state management
export async function cleanupAuthState(): Promise<void> {
  try {
    localStorage.removeItem("user");
    console.log('✅ Auth state cleaned');
  } catch (error) {
    console.error('❌ Auth cleanup error:', error);
  }
}
