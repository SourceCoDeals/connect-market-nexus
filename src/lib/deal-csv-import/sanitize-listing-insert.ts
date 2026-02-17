import { DEAL_IMPORT_FIELDS } from './constants';

/**
 * Final safety net: ensure we never attempt to insert columns that don't exist.
 * This prevents PGRST204 schema-cache errors when older AI models suggest legacy fields.
 */

const EXTRA_ALLOWED_FIELDS = [
  // system-managed / defaults we set during import
  'status',
  'is_internal_deal',
  'deal_source',
  'pushed_to_all_deals',
  // required in schema (NOT NULL) but not user-mapped (public/anon-friendly)
  'location',
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

  // Copy allowed fields only
  for (const [k, v] of Object.entries(data)) {
    if (!ALLOWED_LISTING_INSERT_FIELDS.has(k)) continue;
    if (v === undefined) continue;
    out[k as keyof T] = v as T[keyof T];
  }

  // CRITICAL: Ensure required NOT NULL fields have valid values
  // These defaults prevent database constraint violations

  // description: required string, default to title if missing
  if (typeof (out as any).description !== 'string' || !(out as any).description?.trim()) {
    (out as any).description = (out as any).title || '';
  }

  // revenue: required number, default to 0
  if (typeof (out as any).revenue !== 'number' || isNaN((out as any).revenue)) {
    (out as any).revenue = 0;
  }

  // ebitda: required number, default to 0
  if (typeof (out as any).ebitda !== 'number' || isNaN((out as any).ebitda)) {
    (out as any).ebitda = 0;
  }

  // location: required string, ensure it exists
  // This should already be set by the caller (DealImportDialog/DealCSVImport)
  // but add a final fallback to prevent constraint violations
  if (typeof (out as any).location !== 'string' || !(out as any).location?.trim()) {
    (out as any).location = 'Unknown';
  }

  // category: required string, ensure it exists
  if (typeof (out as any).category !== 'string' || !(out as any).category?.trim()) {
    (out as any).category = 'Other';
  }

  return out;
}
