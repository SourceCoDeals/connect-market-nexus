
import { User, BuyerType, ApprovalStatus, ListingStatus } from "../types";

export interface AdminUser extends User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  website: string;
  phone_number: string;
  is_admin: boolean;
  approval_status: ApprovalStatus;
  buyer_type: BuyerType;
  created_at: string;
  updated_at: string;
}

export interface AdminListing {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  tags: string[];
  owner_notes?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  files?: string[];
  status: ListingStatus;
}

export interface AdminConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  created_at: string;
  updated_at: string;
  user: User | null;
  listing: Partial<AdminListing> | null;
}

export interface AdminActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  totalListings: number;
  pendingConnections: number;
}
