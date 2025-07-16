
export interface ParsedListing {
  title: string;
  category: string;
  location: string;
  revenue: number;
  ebitda: number;
  description: string;
  owner_notes: string;
  status: 'active' | 'inactive';
  tags: string[];
  image_url?: string | null;
}

export interface BulkImportResult {
  success: boolean;
  id?: string;
  title: string;
  error?: string;
  image_processed?: boolean;
  image_url?: string;
}

export interface BulkImportProgress {
  total: number;
  completed: number;
  errors: string[];
  results: BulkImportResult[];
  current_operation?: string;
  images_processed?: number;
  images_failed?: number;
}

export interface ImageProcessingResult {
  success: boolean;
  url?: string;
  error?: string;
}
