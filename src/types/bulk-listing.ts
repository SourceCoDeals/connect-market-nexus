
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
}

export interface BulkImportResult {
  success: boolean;
  id?: string;
  title: string;
  error?: string;
}

export interface BulkImportProgress {
  total: number;
  completed: number;
  errors: string[];
  results: BulkImportResult[];
}
