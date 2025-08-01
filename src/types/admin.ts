
import { User, Listing } from "@/types";

export interface AdminListing {
  id: string;
  title: string;
  categories: string[]; // Array of categories
  category?: string; // Keep for backward compatibility
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  tags: string[];
  owner_notes?: string;
  files?: string[];
  image_url?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateListingData {
  title: string;
  categories: string[];
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  tags?: string[];
  owner_notes?: string;
  status?: 'active' | 'inactive';
}

export interface AdminConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment?: string;
  user_message?: string;
  followed_up?: boolean;
  followed_up_at?: string;
  followed_up_by?: string;
  created_at: string;
  updated_at: string;
  decision_at?: string;
  user?: User | null;
  listing?: Listing | null;
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  totalListings: number;
  pendingConnections: number;
  approvedConnections: number;
}

export interface AdminActivity {
  id: string;
  type: 'signup' | 'connection_request' | 'listing_creation';
  description: string;
  timestamp: string;
  user_id?: string;
}
