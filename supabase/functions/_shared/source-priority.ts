/**
 * Source Priority System for Deal Enrichment
 * Implements field-level source tracking per spec:
 * Priority: Transcript > Notes > Website > CSV (highest to lowest)
 */

export type ExtractionSource = 'transcript' | 'notes' | 'website' | 'csv' | 'manual';

export interface FieldSource {
  source: ExtractionSource;
  timestamp: string;
  transcriptId?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export type ExtractionSources = Record<string, FieldSource>;

// Source priority (lower number = higher priority)
const SOURCE_PRIORITY: Record<ExtractionSource, number> = {
  'transcript': 1,
  'notes': 2,
  'website': 3,
  'csv': 4,
  'manual': 0, // Manual always wins
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
  
  // If no existing source tracked, allow if new source is high priority
  if (!existingSource) {
    return true;
  }
  
  // For protected fields, only transcript or manual can overwrite
  if (PROTECTED_FIELDS.has(fieldName)) {
    return newSource === 'manual' || 
           (newSource === 'transcript' && existingSource !== 'transcript' && existingSource !== 'manual');
  }
  
  // Compare priorities (lower number = higher priority)
  const existingPriority = SOURCE_PRIORITY[existingSource] ?? 999;
  const newPriority = SOURCE_PRIORITY[newSource];
  
  return newPriority < existingPriority;
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
): { updates: Partial<T>; sourceUpdates: ExtractionSources } {
  const updates: Partial<T> = {};
  const sourceUpdates: ExtractionSources = {};
  
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
    }
  }
  
  return { updates, sourceUpdates };
}
