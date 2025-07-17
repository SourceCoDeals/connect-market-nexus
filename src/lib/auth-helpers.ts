
import { User, ApprovalStatus, BuyerType } from "@/types";

export function createUserObject(profile: any): User {
  // Ensure we have a valid profile object
  if (!profile || !profile.id) {
    console.warn('Invalid profile data received:', profile);
    throw new Error('Invalid profile data');
  }

  try {
    return {
      id: profile.id,
      email: profile.email || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      company: profile.company || '',
      website: profile.website || '',
      phone_number: profile.phone_number || '',
      role: 'buyer' as const,
      email_verified: Boolean(profile.email_verified),
      approval_status: (profile.approval_status || 'pending') as ApprovalStatus,
      is_admin: Boolean(profile.is_admin),
      buyer_type: (profile.buyer_type || 'corporate') as BuyerType,
      created_at: profile.created_at || new Date().toISOString(),
      updated_at: profile.updated_at || new Date().toISOString(),
      
      // Additional profile fields with proper defaults
      company_name: profile.company_name || '',
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
      
      // Computed properties (aliases for snake_case properties)
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
  } catch (error) {
    console.error('Error creating user object:', error, 'Profile:', profile);
    throw new Error('Failed to create user object');
  }
}

export function isUserAdmin(user: User | null): boolean {
  return user?.is_admin === true;
}

export async function cleanupAuthState(): Promise<void> {
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('user');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
}
