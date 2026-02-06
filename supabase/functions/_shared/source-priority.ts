/**
 * Source Priority System for Deal Enrichment
 * Implements field-level source tracking per Whispers spec:
 * Priority: Transcript (100) > Notes (80) > Website (60) > CSV (40) > Manual (20)
 *
 * Higher priority sources can overwrite lower priority sources.
 * Prevents low-quality data from corrupting high-quality extractions.
 */

export type ExtractionSource = 'transcript' | 'notes' | 'website' | 'csv' | 'manual';

export interface FieldSource {
  source: ExtractionSource;
  timestamp: string;
  transcriptId?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export type ExtractionSources = Record<string, FieldSource>;

// Source priority scores (higher number = higher priority)
// Whispers spec: transcript:100 > notes:80 > website:60 > csv:40 > manual:20
const SOURCE_PRIORITY: Record<ExtractionSource, number> = {
  'transcript': 100, // Highest - call transcripts are most authoritative
  'notes': 80,       // Broker notes and internal memos
  'website': 60,     // Website scraping
  'csv': 40,         // CSV imports
  'manual': 20,      // Manual entry (lowest priority, can be overridden)
};

// Fields that should never be overwritten once set from transcripts
const PROTECTED_FIELDS = new Set([
  'revenue',
  'ebitda',
  'owner_goals',
  'transition_preferences',
  'special_requirements',
  'key_quotes',
]);

/**
 * Check if a new source can overwrite an existing field value
 * Returns true if new source has higher or equal priority
 */
export function canOverwriteField(
  fieldName: string,
  existingSource: ExtractionSource | null | undefined,
  newSource: ExtractionSource,
  existingValue: unknown
): boolean {
  // If no existing value, always allow
  if (existingValue === null || existingValue === undefined || existingValue === '') {
    return true;
  }

  // If empty array, allow
  if (Array.isArray(existingValue) && existingValue.length === 0) {
    return true;
  }

  // If no existing source tracked, allow any new source
  if (!existingSource) {
    return true;
  }

  // For protected fields (revenue, ebitda, owner_goals), only equal or higher priority can overwrite
  if (PROTECTED_FIELDS.has(fieldName)) {
    const existingPriority = SOURCE_PRIORITY[existingSource] ?? 0;
    const newPriority = SOURCE_PRIORITY[newSource];
    // Protected fields require higher or equal priority
    return newPriority >= existingPriority;
  }

  // Compare priorities (higher number = higher priority per Whispers spec)
  const existingPriority = SOURCE_PRIORITY[existingSource] ?? 0;
  const newPriority = SOURCE_PRIORITY[newSource];

  // Allow overwrite if new source has higher OR equal priority.
  // This is critical for idempotency: re-running transcript enrichment must be able
  // to re-apply transcript-derived values even when the field is already tagged as
  // coming from transcripts.
  return newPriority >= existingPriority;
}

/**
 * Get the source of a field from extraction_sources JSONB
 */
export function getFieldSource(
  extractionSources: ExtractionSources | null | undefined,
  fieldName: string
): FieldSource | null {
  if (!extractionSources || typeof extractionSources !== 'object') {
    return null;
  }
  return extractionSources[fieldName] || null;
}

/**
 * Create a new field source entry
 */
export function createFieldSource(
  source: ExtractionSource,
  transcriptId?: string,
  confidence?: 'high' | 'medium' | 'low'
): FieldSource {
  return {
    source,
    timestamp: new Date().toISOString(),
    ...(transcriptId && { transcriptId }),
    ...(confidence && { confidence }),
  };
}

/**
 * Update extraction sources with new field sources
 */
export function updateExtractionSources(
  existing: ExtractionSources | null | undefined,
  updates: Record<string, FieldSource>
): ExtractionSources {
  return {
    ...(existing || {}),
    ...updates,
  };
}

/**
 * Build updates object respecting source priority
 * Returns only fields that should be updated based on priority rules
 */
export function buildPriorityUpdates<T extends Record<string, unknown>>(
  existingData: T,
  extractionSources: ExtractionSources | null | undefined,
  newData: Partial<T>,
  newSource: ExtractionSource,
  transcriptId?: string
): { updates: Partial<T>; sourceUpdates: ExtractionSources; rejected: string[] } {
  const updates: Partial<T> = {};
  const sourceUpdates: ExtractionSources = {};
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(newData)) {
    if (value === null || value === undefined) continue;

    const existingFieldSource = getFieldSource(extractionSources, key);
    const existingSourceType = existingFieldSource?.source;
    const existingValue = existingData[key as keyof T];

    if (canOverwriteField(key, existingSourceType, newSource, existingValue)) {
      (updates as Record<string, unknown>)[key] = value;
      sourceUpdates[key] = createFieldSource(
        newSource,
        transcriptId,
        // Add confidence for financial fields if available
        key === 'revenue' || key === 'ebitda' ? 'high' : undefined
      );
    } else {
      // Track rejected updates for logging
      const existingPriority = SOURCE_PRIORITY[existingSourceType || 'manual'] || 0;
      const newPriority = SOURCE_PRIORITY[newSource];
      rejected.push(
        `${key}: ${newSource}(${newPriority}) blocked by ${existingSourceType}(${existingPriority})`
      );
    }
  }

  // Log rejected updates if any
  if (rejected.length > 0) {
    console.log(`[SourcePriority] Rejected ${rejected.length} lower-priority updates:`, rejected);
  }

  return { updates, sourceUpdates, rejected };
}
