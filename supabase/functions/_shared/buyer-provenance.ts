/**
 * Buyer Data Provenance System
 *
 * Enforces field-level ownership and source priority for buyer enrichment.
 * Prevents low-quality data from overwriting high-quality transcript-derived data.
 */

export type BuyerSourceType = 'platform_website' | 'pe_firm_website' | 'transcript' | 'buyer_transcript' | 'csv' | 'manual' | 'notes';

// Fields that may ONLY be populated from platform website or transcripts — NEVER from PE firm website
export const PLATFORM_OWNED_FIELDS = new Set([
  // Business Identity
  'company_name', 'business_summary', 'services_offered', 'business_type',
  'industry_vertical', 'specialized_focus', 'revenue_model',
  // Customer Profile
  'primary_customer_size', 'customer_industries', 'customer_geographic_reach', 'target_customer_profile',
]);

// Fields that may ONLY be populated from PE firm website (or transcripts)
export const PE_FIRM_OWNED_FIELDS = new Set([
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
  'num_platforms',
]);

// Fields that are NEVER overwritten from website/notes if they have transcript source
// These represent high-confidence data from direct buyer conversations
export const TRANSCRIPT_PROTECTED_FIELDS = new Set([
  // Investment Thesis
  'thesis_summary',
  'strategic_priorities',
  'thesis_confidence',

  // Size Criteria
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
]);

// Transcript-only fields that can NEVER come from websites
const TRANSCRIPT_ONLY_FIELDS = new Set([
  'target_revenue_min', 'target_revenue_max', 'revenue_sweet_spot',
  'target_ebitda_min', 'target_ebitda_max', 'ebitda_sweet_spot',
]);

/**
 * Validates whether a field may be written from a given source type.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function validateFieldProvenance(
  fieldName: string,
  sourceType: BuyerSourceType,
): { allowed: boolean; reason?: string } {
  // Transcripts and CSV can write to any field
  if (sourceType === 'transcript' || sourceType === 'buyer_transcript' || sourceType === 'csv') {
    return { allowed: true };
  }

  // Manual/notes sources need additional checks
  if (sourceType === 'manual' || sourceType === 'notes') {
    // Notes/manual cannot overwrite transcript-only fields (size criteria)
    if (TRANSCRIPT_ONLY_FIELDS.has(fieldName)) {
      return {
        allowed: false,
        reason: `PROVENANCE VIOLATION: Notes/manual edits cannot set ${fieldName}. This field can only come from transcripts.`,
      };
    }
    return { allowed: true };  // Otherwise allowed (subject to transcript protection check)
  }

  // PE firm website → platform-owned fields = FORBIDDEN
  if (sourceType === 'pe_firm_website' && PLATFORM_OWNED_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write pe_firm_website data to platform-owned field '${fieldName}'. This is forbidden.`,
    };
  }

  // Platform website → PE-owned fields = FORBIDDEN
  if (sourceType === 'platform_website' && PE_FIRM_OWNED_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write platform_website data to PE-owned field '${fieldName}'. This is forbidden.`,
    };
  }

  // ANY website → transcript-only fields = FORBIDDEN
  if ((sourceType === 'platform_website' || sourceType === 'pe_firm_website') && TRANSCRIPT_ONLY_FIELDS.has(fieldName)) {
    return {
      allowed: false,
      reason: `PROVENANCE VIOLATION: Attempted to write ${sourceType} data to transcript-only field '${fieldName}'. Deal structure can only come from transcripts.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a field is protected by a transcript source.
 * Returns true if the field should NOT be overwritten.
 */
export function isProtectedByTranscript(
  fieldName: string,
  buyer: { extraction_sources?: any; [key: string]: any },
  currentValue: any
): boolean {
  // Not a transcript-protected field
  if (!TRANSCRIPT_PROTECTED_FIELDS.has(fieldName)) {
    return false;
  }

  // No current value to protect
  if (!currentValue && currentValue !== 0 && currentValue !== false) {
    return false;
  }

  // Check if buyer has transcript source
  const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
  const hasTranscriptSource = existingSources.some(
    (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript' || src.source === 'transcript'
  );

  return hasTranscriptSource;
}

/**
 * Check if buyer has transcript source for ANY field
 */
export function hasTranscriptSource(buyer: { extraction_sources?: any }): boolean {
  const existingSources = Array.isArray(buyer.extraction_sources) ? buyer.extraction_sources : [];
  return existingSources.some(
    (src: any) => src.type === 'transcript' || src.type === 'buyer_transcript' || src.source === 'transcript'
  );
}
