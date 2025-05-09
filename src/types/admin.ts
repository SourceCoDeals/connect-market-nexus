
import { Listing, ListingStatus, User, BuyerType, ApprovalStatus } from '@/types';

// Admin-specific types
export interface AdminListing extends Listing {
  // Add any admin-specific fields here
}

export interface AdminUser extends User {
  // Add any admin-specific fields here
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
  listing: Listing | null;
}

export interface AdminActivity {
  id: string;
  type: 'signup' | 'connection_request' | 'listing_creation' | string;
  description: string;
  timestamp: string;
  user_id?: string;
}

export interface AdminStats {
  // Maintaining backward compatibility with existing code
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  totalListings: number;
  pendingConnections: number;
  approvedConnections: number;
  
  // Original structure that may be used in the future
  userStats: {
    totalUsers: number;
    pendingUsers: number;
    approvedUsers: number;
    deniedUsers: number;
  };
  listingStats: {
    totalListings: number;
    activeListings: number;
    inactiveListings: number;
  };
  connectionStats: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  };
  activityStats: {
    last7Days: number;
    last30Days: number;
  };
  recentActivity: Array<{
    id: string;
    user_id: string;
    activity_type: string;
    created_at: string;
    metadata?: any;
    user?: {
      first_name: string;
      last_name: string;
      email: string;
    }
  }>;
}
