// Shared utilities for extraction source tracking
// Source priority: transcript > notes > website > csv > manual

export type ExtractionSourceType = 'transcript' | 'notes' | 'website' | 'csv' | 'manual';

export interface ExtractionSource {
  source: ExtractionSourceType;
  timestamp: string;
  fields: string[];
}

// Priority order (higher = more authoritative)
export const SOURCE_PRIORITY: Record<ExtractionSourceType, number> = {
  transcript: 100,
  notes: 80,
  website: 60,
  csv: 40,
  manual: 20,
};

/**
 * Get the source of a specific field from extraction_sources
 */
export function getFieldSource(
  extractionSources: ExtractionSource[] | null | undefined,
  fieldName: string
): ExtractionSource | null {
  if (!extractionSources || !Array.isArray(extractionSources)) return null;

  // Find the most recent source that includes this field
  const sourcesWithField = extractionSources
    .filter(s => s.fields?.includes(fieldName))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return sourcesWithField[0] || null;
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
