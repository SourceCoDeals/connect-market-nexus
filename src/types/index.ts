
export type UserRole = 'admin' | 'buyer';

export type BuyerType = 'corporate' | 'privateEquity' | 'familyOffice' | 'searchFund' | 'individual';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  website: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  isApproved: boolean;
  buyerType: BuyerType;
  createdAt: string;
  additionalInfo?: Record<string, any>;
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
  ownerNotes: string;
  files?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionRequest {
  id: string;
  userId: string;
  listingId: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment?: string;
  createdAt: string;
  updatedAt: string;
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
