/**
 * Data Provenance System
 *
 * Defines which fields may be populated from which source type.
 * This is the SINGLE SOURCE OF TRUTH for data ownership rules.
 *
 * Three layers of enforcement:
 * 1. Extract-time: validateFieldProvenance() blocks prohibited field+source combos
 * 2. Source priority: TRANSCRIPT_PROTECTED_FIELDS prevents website overwrites
 * 3. Write-time: buildUpdateObject() in buyer-extraction.ts re-validates before DB write
 */

export type SourceType = 'platform_website' | 'pe_firm_website' | 'transcript' | 'csv' | 'manual';

// Fields that may ONLY be populated from platform website or transcripts — NEVER from PE firm website
export const PLATFORM_OWNED_FIELDS = new Set([
  // Business Identity
  'company_name', 'business_summary', 'services_offered', 'business_type',
  'industry_vertical', 'specialized_focus', 'revenue_model',
  // Customer Profile
  'primary_customer_size', 'customer_industries', 'customer_geographic_reach', 'target_customer_profile',
  // HQ Location — PE firm HQ is NOT the platform's HQ
  'hq_city', 'hq_state', 'hq_country', 'hq_region',
  // Operating footprint — PE firm offices are NOT platform operating locations
  'operating_locations',
]);

// Fields that may ONLY be populated from TRANSCRIPTS — NEVER from any website
// Financial information must never be scraped from websites per policy.
// This includes both actual company financials AND PE firm investment size criteria,
// since website-sourced financial data is unreliable and may violate data policies.
export const TRANSCRIPT_ONLY_FIELDS = new Set([
  'num_platforms', 'deal_preferences',
  // Size criteria — financial data must NEVER come from website scraping
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
]);

// Fields allowed to fall back from PE firm website when platform website is unavailable
// ONLY broad geographic coverage fields — NEVER HQ or operating locations
// PE firm HQ (e.g., Dallas TX) is NOT the platform company's HQ
export const PE_FALLBACK_ALLOWED_FIELDS = new Set([
  'geographic_footprint', 'service_regions',
]);

// Fields that can be populated from either source (shared/neutral)
export const SHARED_FIELDS = new Set([
  'target_industries', 'target_services', 'target_geographies',
  'deal_preferences', 'deal_breakers', 'acquisition_timeline',
  'acquisition_appetite', 'acquisition_frequency',
  'recent_acquisitions', 'portfolio_companies', 'total_acquisitions',
  'strategic_priorities', 'thesis_summary', 'thesis_confidence',
  'data_completeness', 'data_last_updated', 'extraction_sources',
  'key_quotes', 'notes', 'has_fee_agreement',
]);

// Fields that are NEVER overwritten from website if they have transcript source
export const TRANSCRIPT_PROTECTED_FIELDS = [
  // Investment Thesis
  'thesis_summary',
  'strategic_priorities',
  'thesis_confidence',

  // Size Criteria (using actual column names)
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',

  // Deal Structure
  'deal_breakers',
  'deal_preferences',

  // Geographic Targeting
  'target_geographies',

  // Business Model Targeting
  'target_industries',
  'target_services',

  // Activity
  'acquisition_appetite',
  'acquisition_timeline',
  'acquisition_frequency',
];

// Placeholder strings to filter out from extracted values
export const PLACEHOLDER_STRINGS = new Set([
  'not specified', 'n/a', 'na', 'unknown', 'none', 'tbd', 'not available', '',
  '<unknown>', '<UNKNOWN>', 'undefined', 'null'
]);

/**
 * Validates whether a field may be written from a given source type.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function validateFieldProvenance(
  fieldName: string,
  sourceType: SourceType,
): { allowed: boolean; reason?: string } {
  // Transcripts, CSV, and manual sources can write to any field
  if (sourceType === 'transcript' || sourceType === 'csv' || sourceType === 'manual') {
    return { allowed: true };
  }

  // PE firm website → platform-owned fields = FORBIDDEN
  if (sourceType === 'pe_firm_website' && PLATFORM_OWNED_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write pe_firm_website data to platform-owned field '${fieldName}'. This is forbidden.`,
    };
  }

  // ANY website → transcript-only fields = FORBIDDEN
  // Deal structure (revenue/EBITDA ranges) can ONLY come from transcripts
  if ((sourceType === 'platform_website' || sourceType === 'pe_firm_website') && TRANSCRIPT_ONLY_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write ${sourceType} data to transcript-only field '${fieldName}'. Deal structure can only come from transcripts.`,
    };
  }

  return { allowed: true };
}
