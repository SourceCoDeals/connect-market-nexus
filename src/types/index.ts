
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
  
  // Computed properties (aliases for snake_case properties)
  get firstName(): string { return this.first_name; }
  get lastName(): string { return this.last_name; }
  get phoneNumber(): string { return this.phone_number; }
  get isAdmin(): boolean { return this.is_admin; }
  get buyerType(): BuyerType { return this.buyer_type; }
  get emailVerified(): boolean { return this.email_verified; }
  get isApproved(): boolean { return this.approval_status === 'approved'; }
  get createdAt(): string { return this.created_at; }
  get updatedAt(): string { return this.updated_at; }
}

export interface Listing {
  id: string;
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  tags: string[];
  owner_notes: string;
  files?: string[];
  created_at: string;
  updated_at: string;
  
  // Computed properties (aliases for snake_case properties)
  get ownerNotes(): string { return this.owner_notes; }
  get createdAt(): string { return this.created_at; }
  get updatedAt(): string { return this.updated_at; }
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
}
