
import { User, Listing } from "@/types";

export interface AdminConnectionRequest {
  id: string;
  user_id: string;
  listing_id: string;
  status: "pending" | "approved" | "rejected";
  admin_comment?: string;
  created_at: string;
  updated_at: string;
  user?: User | null;
  listing?: Listing | null;
}

export interface AdminActivity {
  id: string;
  type: "signup" | "connection_request" | "listing_creation" | "admin_action";
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
  user_id?: string;
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  approvedUsers: number;
  totalListings: number;
  pendingConnections: number;
  approvedConnections: number;
}

// Adding the missing AdminListing type
export interface AdminListing {
  id: string;
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  owner_notes?: string;
  tags?: string[];
  image_url?: string | null;
  files?: string[];
  created_at: string;
  updated_at: string;
}
