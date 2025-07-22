
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
      investment_size: profile.investment_size || '',
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
      business_categories: Array.isArray(profile.business_categories) ? profile.business_categories : [],
      target_locations: profile.target_locations || '',
      revenue_range_min: profile.revenue_range_min || null,
      revenue_range_max: profile.revenue_range_max || null,
      specific_business_search: profile.specific_business_search || '',
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
  
  const validBuyerTypes: BuyerType[] = ['corporate', 'privateEquity', 'familyOffice', 'searchFund', 'individual'];
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
