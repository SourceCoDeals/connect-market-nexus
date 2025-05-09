
export type UserRole = 'admin' | 'buyer';

export type BuyerType = 'corporate' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'individual';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  website: string;
  phone_number: string;
  role: UserRole;
  email_verified: boolean;
  approval_status: ApprovalStatus;
  is_admin: boolean;
  buyer_type: BuyerType;
  created_at: string;
  updated_at: string;
  // Additional fields from profiles table
  company_name?: string;
  estimated_revenue?: string;
  fund_size?: string;
  investment_size?: string;
  aum?: string;
  is_funded?: string;
  funded_by?: string;
  target_company_size?: string;
  funding_source?: string;
  needs_loan?: string;
  ideal_target?: string;
  bio?: string;
  
  // Computed properties (aliases for snake_case properties)
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string;
  readonly isAdmin: boolean;
  readonly buyerType: BuyerType;
  readonly emailVerified: boolean;
  readonly isApproved: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ListingStatus = 'active' | 'inactive';

export interface Listing {
  id: string;
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  tags: string[];
  owner_notes?: string;
  files?: string[];
  created_at: string;
  updated_at: string;
  image_url?: string | null;
  status: ListingStatus;
  
  // Computed properties (aliases for snake_case properties)
  readonly ownerNotes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly multiples?: {
    revenue: string;
    value: string;
  };
  readonly revenueFormatted?: string;
  readonly ebitdaFormatted?: string;
}

export interface ConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface FilterOptions {
  category?: string;
  location?: string;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
  search?: string;
  status?: string;
}
