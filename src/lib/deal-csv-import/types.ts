/**
 * Unified Deal CSV Import Types
 */

export interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  confidence: number;
  aiSuggested: boolean;
}

export interface DealImportField {
  value: string;
  label: string;
  required?: boolean;
  description?: string;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportValidationError[];
  listingIds: string[];
}

export interface ParsedDealData {
  // Required
  title: string;
  
  // Core fields
  website?: string;
  category?: string;
  description?: string;
  executive_summary?: string;
  general_notes?: string;
  internal_notes?: string;
  owner_goals?: string;
  
  // Financial
  revenue?: number;
  ebitda?: number;
  
  // Location - structured
  address?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  
  // Geography
  geographic_states?: string[];
  
  // Business details
  services?: string[];
  full_time_employees?: number;
  number_of_locations?: number;
  
  // Contact
  primary_contact_name?: string;
  primary_contact_first_name?: string;
  primary_contact_last_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  
  // URLs
  linkedin_url?: string;
  fireflies_url?: string;
  
  // Reviews
  google_review_count?: number;
  google_rating?: number;
  
  // Metadata
  internal_company_name?: string;
}
