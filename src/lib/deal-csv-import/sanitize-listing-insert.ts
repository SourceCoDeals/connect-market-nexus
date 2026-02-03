import { DEAL_IMPORT_FIELDS } from './constants';

/**
 * Final safety net: ensure we never attempt to insert columns that don't exist.
 * This prevents PGRST204 schema-cache errors when older AI models suggest legacy fields.
 */

const EXTRA_ALLOWED_FIELDS = [
  // system-managed / defaults we set during import
  'status',
  // row-processor default
  'category',
  // row-processor address default
  'address_country',
] as const;

export const ALLOWED_LISTING_INSERT_FIELDS = new Set<string>([
  ...DEAL_IMPORT_FIELDS.map((f) => f.value),
  ...EXTRA_ALLOWED_FIELDS,
]);

export function sanitizeListingInsert<T extends Record<string, unknown>>(data: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!ALLOWED_LISTING_INSERT_FIELDS.has(k)) continue;
    if (v === undefined) continue;
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
