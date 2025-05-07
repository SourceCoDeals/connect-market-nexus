
import { User } from "./index";
import { ApprovalStatus } from "./index";

export interface AdminListing {
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
}

export interface AdminConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: ApprovalStatus;
  admin_comment?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  listing?: AdminListing;
}

export interface AdminUserActivity {
  id: string;
  type: 'signup' | 'approval' | 'connection_request' | 'listing_creation';
  description: string;
  timestamp: string;
  user_id?: string;
  user?: User;
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  totalListings: number;
  pendingConnections: number;
}
