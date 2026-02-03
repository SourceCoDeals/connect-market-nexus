/**
 * Merge AI-returned mappings with the full list of parsed CSV columns.
 * 
 * Invariant enforced: the returned array always has exactly one entry per
 * parsed column, in the original order.
 * 
 * This prevents the UI from silently dropping columns when the AI returns
 * a partial or unordered mapping list.
 */

import { normalizeHeader } from './parsers';
import { DEAL_IMPORT_FIELDS } from './constants';
import type { ColumnMapping } from './types';

export interface MergeStats {
  /** Total columns parsed from CSV */
  parsedCount: number;
  /** Columns the AI returned a mapping for */
  aiReturnedCount: number;
  /** Columns we filled with a blank default */
  filledCount: number;
}

/**
 * Merge AI mappings with full column list, ensuring every column is present.
 *
 * @param parsedColumns - All column headers parsed from CSV (source of truth)
 * @param aiMappings - Partial/unordered mappings from AI (may be empty or incomplete)
 * @returns Tuple of [mergedMappings, stats]
 */
export function mergeColumnMappings(
  parsedColumns: string[],
  aiMappings: ColumnMapping[] | undefined | null
): [ColumnMapping[], MergeStats] {
  const allowedTargetFields = new Set(DEAL_IMPORT_FIELDS.map((f) => f.value));

  // Build lookup map by normalized csvColumn
  const lookup = new Map<string, ColumnMapping>();
  if (aiMappings && Array.isArray(aiMappings)) {
    for (const m of aiMappings) {
      if (m.csvColumn) {
        // Defensive: ignore AI suggestions for fields we don't support anymore
        const sanitizedTargetField =
          m.targetField && allowedTargetFields.has(m.targetField) ? m.targetField : null;

        const key = normalizeHeader(m.csvColumn).toLowerCase();
        // First match wins (handles duplicates)
        if (!lookup.has(key)) {
          lookup.set(key, {
            ...m,
            targetField: sanitizedTargetField,
            aiSuggested: Boolean(sanitizedTargetField) && Boolean(m.aiSuggested),
          });
        }
      }
    }
  }

  let aiReturnedCount = 0;
  let filledCount = 0;

  const merged: ColumnMapping[] = parsedColumns.map((col) => {
    const key = normalizeHeader(col).toLowerCase();
    const existing = lookup.get(key);
    if (existing) {
      aiReturnedCount++;
      return {
        ...existing,
        csvColumn: col, // Preserve original casing from parsed columns
      };
    }
    // AI didn't provide a mapping for this column – fill with default
    filledCount++;
    return {
      csvColumn: col,
      targetField: null,
      confidence: 0,
      aiSuggested: false,
    };
  });

  const stats: MergeStats = {
    parsedCount: parsedColumns.length,
    aiReturnedCount,
    filledCount,
  };

  return [merged, stats];
}
