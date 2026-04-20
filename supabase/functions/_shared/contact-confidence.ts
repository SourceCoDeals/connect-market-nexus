/**
 * Normalizes third-party enrichment confidence labels to the canonical
 * values `public.contacts.confidence` CHECK-accepts:
 *
 *     'verified' | 'likely' | 'guessed' | 'unverified'
 *
 * Background — why this module exists
 * -----------------------------------
 * `supabase/migrations/20260625000004_extend_contacts_schema.sql` constrains
 * `contacts.confidence` to the four values above. `contacts_upsert` passes
 * `p_enrichment->>'confidence'` straight through into the column, so any
 * caller that supplies 'high' / 'medium' / 'low' (the natural values most
 * vendors use) trips the CHECK and the whole RPC RAISEs. The webhooks
 * silently swallow that as an "upsert failed" counter and the contact
 * never gets enriched — so Clay / Blitz / Serper / find-contacts results
 * stop landing on the canonical contacts table the moment the CHECK ships.
 *
 * Canonical mapping (matches the documentation in 20260625000004):
 *
 *   verified   — explicit user confirmation OR provider "high" confidence
 *   likely     — pattern match with 2+ corroborating sources (provider 'medium')
 *   guessed    — single-source pattern match (provider 'low')
 *   unverified — no enrichment attempt yet, or unknown confidence
 *
 * Callers must run every provider-supplied confidence string through
 * `normalizeConfidence()` before packaging it into `p_enrichment`.
 */

export type CanonicalConfidence = 'verified' | 'likely' | 'guessed' | 'unverified';

const CANONICAL = new Set<CanonicalConfidence>(['verified', 'likely', 'guessed', 'unverified']);

const PROVIDER_ALIASES: Record<string, CanonicalConfidence> = {
  high: 'verified',
  confirmed: 'verified',
  strong: 'verified',

  medium: 'likely',
  mid: 'likely',
  moderate: 'likely',
  probable: 'likely',

  low: 'guessed',
  weak: 'guessed',
  suspect: 'guessed',

  unknown: 'unverified',
  none: 'unverified',
  null: 'unverified',
  '': 'unverified',
};

/**
 * Map an arbitrary confidence label to the canonical set. Unrecognized
 * values default to 'unverified' rather than throwing — enrichment should
 * degrade gracefully when a vendor introduces a new label rather than
 * losing the whole enrichment event.
 */
export function normalizeConfidence(raw: unknown): CanonicalConfidence {
  if (raw == null) return 'unverified';
  const key = String(raw).trim().toLowerCase();
  if (CANONICAL.has(key as CanonicalConfidence)) {
    return key as CanonicalConfidence;
  }
  return PROVIDER_ALIASES[key] ?? 'unverified';
}

/**
 * Convenience: returns a new enrichment object with its `confidence`
 * normalized. Preserves all other keys unchanged. Useful when building
 * the `p_enrichment` JSONB argument passed to `contacts_upsert`.
 */
export function normalizeEnrichmentConfidence<
  T extends { confidence?: unknown } | null | undefined,
>(enrichment: T): T extends null | undefined ? T : T & { confidence: CanonicalConfidence } {
  if (enrichment == null) return enrichment as never;
  return {
    ...enrichment,
    confidence: normalizeConfidence((enrichment as { confidence?: unknown }).confidence),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
