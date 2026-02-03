import type { DealImportField } from './types';

/**
 * All available fields for deal CSV import
 * Status is intentionally omitted - it should never be imported
 */
export const DEAL_IMPORT_FIELDS: DealImportField[] = [
  // Required
  { value: "title", label: "Company Name *", required: true, description: "Business/company name (required)" },
  
  // Core fields
  { value: "website", label: "Website URL", description: "Company website for enrichment" },
  { value: "category", label: "Industry/Category", description: "Business category (e.g., Collision, HVAC)" },
  { value: "description", label: "Description / AI Summary", description: "Business description or AI-generated summary" },
  { value: "executive_summary", label: "Executive Summary", description: "Deal executive summary" },
  { value: "general_notes", label: "Notes / Bill Notes", description: "General notes about the deal" },
  { value: "internal_notes", label: "Internal Notes", description: "Internal-only notes" },
  { value: "owner_goals", label: "Owner Goals", description: "Seller motivation and goals" },
  
  // Financial
  { value: "revenue", label: "Revenue", description: "Annual revenue (supports $, K, M formats)" },
  { value: "ebitda", label: "EBITDA", description: "EBITDA amount (supports $, K, M formats)" },
  
  // Address - structured
  { value: "address", label: "Full Address", description: "Complete address (city/state will be extracted)" },
  { value: "address_city", label: "City", description: "City name" },
  { value: "address_state", label: "State (2-letter)", description: "State abbreviation (e.g., TX, CA)" },
  { value: "address_zip", label: "ZIP Code", description: "Postal code" },
  
  // Geography
  { value: "geographic_states", label: "States/Geography", description: "Operating states (comma-separated)" },
  
  // Business details
  { value: "services", label: "Services", description: "Services offered (comma-separated)" },
  { value: "full_time_employees", label: "Employee Count", description: "Number of employees" },
  { value: "number_of_locations", label: "Number of Locations", description: "Location count" },
  
  // Contact
  { value: "primary_contact_name", label: "Contact Name", description: "Full name of primary contact" },
  { value: "primary_contact_first_name", label: "Contact First Name", description: "First name (will combine with last)" },
  { value: "primary_contact_last_name", label: "Contact Last Name", description: "Last name (will combine with first)" },
  { value: "primary_contact_email", label: "Contact Email", description: "Email address" },
  { value: "primary_contact_phone", label: "Contact Phone", description: "Phone number" },
  { value: "primary_contact_title", label: "Contact Title/Role", description: "Job title or role" },
  
  // URLs
  { value: "linkedin_url", label: "LinkedIn URL", description: "Company LinkedIn profile" },
  { value: "fireflies_url", label: "Fireflies/Recording URL", description: "Call recording or transcript URL" },
  
  // Reviews
  { value: "google_review_count", label: "Google Review Count", description: "Number of Google reviews" },
  { value: "google_review_score", label: "Google Review Score", description: "Google rating (1-5)" },
  
  // Metadata
  { value: "internal_company_name", label: "Internal Company Name", description: "Internal reference name" },
  { value: "last_contacted_at", label: "Last Contacted Date", description: "Date of last contact" },
];

/**
 * Fields that should never be imported from CSV
 */
export const IGNORED_CSV_COLUMNS = [
  'status',
  'deal status',
  'stage',
  'pipeline stage',
  'marketplace',
  'fit / not fit',
  'fit/not fit',
  'fit',
  'not fit',
  'qualified',
  'buyers shown',
  'appointment',
  'appointment booked',
  'data source',
  'employee range', // We use exact count, not range
];

/**
 * Numeric fields that need special parsing
 */
export const NUMERIC_FIELDS = [
  'revenue',
  'ebitda',
  'google_review_score',
];

/**
 * Integer fields that need rounding
 */
export const INTEGER_FIELDS = [
  'full_time_employees',
  'number_of_locations',
  'google_review_count',
];

/**
 * Array fields that need splitting
 */
export const ARRAY_FIELDS = [
  'services',
  'geographic_states',
];
