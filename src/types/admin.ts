
import { User } from "@/types";

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  totalListings: number;
  pendingConnections: number;
}

export interface AdminUserActivity {
  id: string;
  type: "signup" | "approval" | "connection_request" | "listing_creation";
  description: string;
  timestamp: string;
  user_id?: string;
}

export interface AdminListing {
  id: string;
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  tags: string[] | null;
  owner_notes?: string | null;
  files?: string[] | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
}

export interface AdminConnectionRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  user: User;
  listing: {
    id: string;
    title: string;
  };
  admin_comment?: string | null;
}
