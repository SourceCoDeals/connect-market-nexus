// Shared utilities for extraction source tracking
// Aligned with backend provenance.ts SourceType definitions
// Source priority: manual > transcript > csv > marketplace > website > notes

/**
 * Frontend ExtractionSourceType — aligned with backend SourceType from provenance.ts.
 * Backend canonical types: 'platform_website' | 'pe_firm_website' | 'transcript' | 'csv' | 'manual' | 'marketplace'
 * Frontend adds 'notes' for display purposes and uses 'website' as an alias for both website types.
 */
export type ExtractionSourceType =
  | 'transcript'
  | 'notes'
  | 'website'           // Display alias — maps to 'platform_website' or 'pe_firm_website' on backend
  | 'platform_website'  // Canonical backend type
  | 'pe_firm_website'   // Canonical backend type
  | 'csv'
  | 'manual'
  | 'marketplace';

/** Standard evidence record format */
export interface ExtractionSource {
  source: ExtractionSourceType;
  timestamp: string;
  fields: string[];
}

/** Per-field source tracking record (type: 'field_sources') */
export interface FieldSourceRecord {
  type: 'field_sources';
  fields: Record<string, { source: ExtractionSourceType; priority: number; at: string }>;
}

// Priority order (higher = more authoritative)
// Aligned with backend provenance.ts SOURCE_PRIORITY
export const SOURCE_PRIORITY: Record<ExtractionSourceType, number> = {
  manual: 110,            // Admin hand-edits — highest priority
  transcript: 100,        // Direct conversations — most reliable
  csv: 90,                // Bulk imports from verified data
  marketplace: 80,        // Self-reported signup data
  notes: 80,              // Frontend-only alias, same priority as marketplace
  platform_website: 60,   // Scraped from operating company's website
  pe_firm_website: 60,    // Scraped from PE firm's website
  website: 60,            // Generic alias for either website type
};

/**
 * Normalize backend source type strings to canonical frontend types.
 * Handles legacy aliases from the backend provenance system.
 */
export function normalizeSourceType(type: string): ExtractionSourceType {
  switch (type) {
    case 'buyer_transcript':
    case 'transcript':
      return 'transcript';
    case 'marketplace_profile':
    case 'marketplace_backfill':
    case 'marketplace_sync':
      return 'marketplace';
    case 'platform_website':
      return 'platform_website';
    case 'pe_firm_website':
      return 'pe_firm_website';
    case 'website':
      return 'website';
    case 'csv':
      return 'csv';
    case 'manual':
      return 'manual';
    case 'notes':
      return 'notes';
    default:
      return 'website'; // safe default
  }
}

/**
 * Get the source of a specific field from extraction_sources.
 * Supports both standard evidence records and per-field source tracking records.
 */
export function getFieldSource(
  extractionSources: (ExtractionSource | FieldSourceRecord)[] | null | undefined,
  fieldName: string
): ExtractionSource | null {
  if (!extractionSources || !Array.isArray(extractionSources)) return null;

  let bestSource: ExtractionSource | null = null;
  let bestTime = 0;

  for (const src of extractionSources) {
    // Handle per-field source tracking record
    if ('type' in src && src.type === 'field_sources' && 'fields' in src && typeof src.fields === 'object') {
      const fieldEntry = (src as FieldSourceRecord).fields[fieldName];
      if (fieldEntry) {
        const t = new Date(fieldEntry.at).getTime();
        if (t > bestTime) {
          bestTime = t;
          bestSource = {
            source: normalizeSourceType(fieldEntry.source),
            timestamp: fieldEntry.at,
            fields: [fieldName],
          };
        }
      }
      continue;
    }

    // Handle standard evidence records
    const record = src as ExtractionSource;
    if (!record.fields?.includes(fieldName)) continue;

    const t = new Date(record.timestamp).getTime();
    if (t > bestTime) {
      bestTime = t;
      bestSource = record;
    }
  }

  return bestSource;
}

/**
 * Check if a field can be overwritten by a new source
 */
export function canOverwriteField(
  existingSources: ExtractionSource[] | null | undefined,
  fieldName: string,
  newSourceType: ExtractionSourceType
): boolean {
  const existingSource = getFieldSource(existingSources, fieldName);

  // No existing source = can overwrite
  if (!existingSource) return true;

  const existingPriority = SOURCE_PRIORITY[existingSource.source] || 0;
  const newPriority = SOURCE_PRIORITY[newSourceType] || 0;

  // Can overwrite if new source has higher or equal priority
  return newPriority >= existingPriority;
}

/**
 * Add a new source entry, merging with existing sources
 */
export function addSourceEntry(
  existingSources: ExtractionSource[] | null | undefined,
  newSource: ExtractionSourceType,
  newFields: string[]
): ExtractionSource[] {
  const sources = existingSources && Array.isArray(existingSources) ? [...existingSources] : [];

  if (newFields.length === 0) return sources;

  sources.push({
    source: newSource,
    timestamp: new Date().toISOString(),
    fields: newFields,
  });

  return sources;
}

/**
 * Get fields that should NOT be overwritten by a lower-priority source
 */
export function getProtectedFields(
  existingSources: ExtractionSource[] | null | undefined,
  newSourceType: ExtractionSourceType
): string[] {
  if (!existingSources || !Array.isArray(existingSources)) return [];

  const newPriority = SOURCE_PRIORITY[newSourceType] || 0;
  const protectedFields: Set<string> = new Set();

  for (const source of existingSources) {
    const sourcePriority = SOURCE_PRIORITY[source.source] || 0;
    if (sourcePriority > newPriority && source.fields) {
      source.fields.forEach(f => protectedFields.add(f));
    }
  }

  return Array.from(protectedFields);
}
