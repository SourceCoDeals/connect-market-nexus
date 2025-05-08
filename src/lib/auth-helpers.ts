
import { User } from '@/types';

/**
 * Helper function to create a consistent User object from profile data
 */
export const createUserObject = (profile: any): User => {
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
    company: profile.company || '',
    website: profile.website || '',
    phone_number: profile.phone_number || '',
    role: profile.is_admin ? 'admin' as const : 'buyer' as const,
    email_verified: profile.email_verified,
    approval_status: profile.approval_status,
    is_admin: profile.is_admin,
    buyer_type: profile.buyer_type || 'corporate',
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    company_name: profile.company_name,
    estimated_revenue: profile.estimated_revenue,
    fund_size: profile.fund_size,
    investment_size: profile.investment_size,
    aum: profile.aum,
    is_funded: profile.is_funded,
    funded_by: profile.funded_by,
    target_company_size: profile.target_company_size,
    funding_source: profile.funding_source,
    needs_loan: profile.needs_loan,
    ideal_target: profile.ideal_target,
    bio: profile.bio,
    
    // Computed properties
    firstName: profile.first_name,
    lastName: profile.last_name,
    phoneNumber: profile.phone_number || '',
    isAdmin: profile.is_admin,
    buyerType: profile.buyer_type || 'corporate',
    emailVerified: profile.email_verified,
    isApproved: profile.approval_status === 'approved',
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  };
};

/**
 * Helper function to clean up authentication state
 * This is exported for compatibility with other files that import it
 * but it delegates to the main implementation in supabase/client.ts
 */
export const cleanupAuthState = () => {
  // Import dynamically to avoid circular dependencies
  const { cleanupAuthState: actualCleanup } = require('@/integrations/supabase/client');
  return actualCleanup();
};
