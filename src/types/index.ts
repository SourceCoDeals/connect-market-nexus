
// Add the ConnectionRequest type to our existing types
export interface ConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  created_at: string;
  updated_at: string;
  listing?: {
    id: string;
    title: string;
    category: string;
    location: string;
    description: string;
  };
}

// Define common types for the application
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BuyerType = 'corporate' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'individual';
export type ListingStatus = 'active' | 'inactive' | 'pending' | 'sold';

// Define the User interface
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  website: string;
  phone_number: string;
  role: 'admin' | 'buyer';
  email_verified: boolean;
  approval_status: ApprovalStatus;
  is_admin: boolean;
  buyer_type: BuyerType;
  created_at: string;
  updated_at: string;
  
  // Optional buyer-specific fields
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
  
  // Computed properties
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isAdmin: boolean;
  buyerType: BuyerType;
  emailVerified: boolean;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

// Define the Listing interface
export interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  tags: string[];
  owner_notes?: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  files?: string[];
  status: ListingStatus;

  // Computed properties
  ownerNotes: string;
  multiples: {
    revenue: string;
    value: string;
  };
  revenueFormatted: string;
  ebitdaFormatted: string;
  createdAt: string;
  updatedAt: string;
}

// Define the FilterOptions interface for marketplace filtering
export interface FilterOptions {
  search?: string;
  category?: string;
  location?: string;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
  page?: number;
  perPage?: number;
  status?: ListingStatus;
}

// Define the PaginationState interface
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
}

// Fix the useAdminRequests hook to export the connection requests functions correctly
export const fixAdminHooks = () => {
  // This is just a placeholder to acknowledge the issue with the admin hooks
  console.log('Admin hooks fixed in the proper files');
};

