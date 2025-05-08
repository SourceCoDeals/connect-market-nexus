
// Auth helper functions
export const cleanupAuthState = () => {
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
  // Remove user data
  localStorage.removeItem("user");
};

export const createUserObject = (profile: any) => {
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
    company: profile.company || '',
    website: profile.website || '',
    phone_number: profile.phone_number || '',
    role: profile.is_admin ? 'admin' : 'buyer',
    email_verified: profile.email_verified,
    approval_status: profile.approval_status,
    is_admin: profile.is_admin,
    buyer_type: profile.buyer_type || 'corporate',
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    // Additional profile fields
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
};
