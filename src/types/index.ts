
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
