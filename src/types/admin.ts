
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
