
import { User, UserRole, ApprovalStatus, BuyerType } from "@/types";

/**
 * Creates a User object with computed properties from profile data
 */
export function createUserFromProfile(profileData: any): User {
  return {
    id: profileData.id,
    email: profileData.email,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    company: profileData.company || '',
    website: profileData.website || '',
    phone_number: profileData.phone_number || '',
    role: profileData.is_admin ? 'admin' as UserRole : 'buyer' as UserRole,
    email_verified: profileData.email_verified,
    approval_status: profileData.approval_status as ApprovalStatus,
    is_admin: profileData.is_admin,
    buyer_type: profileData.buyer_type as BuyerType || 'corporate',
    created_at: profileData.created_at,
    updated_at: profileData.updated_at,
    company_name: profileData.company_name,
    estimated_revenue: profileData.estimated_revenue,
    fund_size: profileData.fund_size,
    investment_size: profileData.investment_size,
    aum: profileData.aum,
    is_funded: profileData.is_funded,
    funded_by: profileData.funded_by,
    target_company_size: profileData.target_company_size,
    funding_source: profileData.funding_source,
    needs_loan: profileData.needs_loan,
    ideal_target: profileData.ideal_target,
    // Computed properties
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
