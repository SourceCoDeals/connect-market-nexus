// ============================================================================
// activity-contact-resolution
// ============================================================================
// Shared helpers for resolving a contact_id from email / LinkedIn URL / name
// when promoting an unmatched activity to its canonical table or when
// logging a manual touch. Used by:
//   - UnmatchedActivitiesPage (Fix #2 — link unmatched → canonical)
//   - LogManualTouchDialog    (Fix #3 — manual touch contact attribution)
//
// Resolution rules (listing-scoped then global, in priority order):
//   1. Email exact match: contacts.email = ? (case-insensitive)
//   2. LinkedIn URL exact match: contacts.linkedin_url = ?
//   3. Fuzzy name match against the listing's primary contact (only fires
//      when the user-entered contact name lower-cased matches the primary
//      contact's first+last name lower-cased)
//
// All resolvers return { contactId, contactType, source } or null. Callers
// decide whether to fall through; nothing here writes data.
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

export interface ResolvedContact {
  contactId: string;
  contactType: string | null;
  source: 'email' | 'linkedin' | 'fuzzy_primary' | 'manual';
}

/** Listing-scoped exact email match falls through to global exact match. */
export async function resolveContactByEmail(
  email: string | null | undefined,
  listingId: string | null | undefined,
): Promise<ResolvedContact | null> {
  if (!email || !email.includes('@')) return null;
  const trimmed = email.trim();

  if (listingId) {
    const { data: scoped } = await supabase
      .from('contacts')
      .select('id, contact_type')
      .eq('listing_id', listingId)
      .ilike('email', trimmed)
      .eq('archived', false)
      .limit(1)
      .maybeSingle();
    if (scoped?.id) {
      return { contactId: scoped.id, contactType: scoped.contact_type ?? null, source: 'email' };
    }
  }

  const { data: global } = await supabase
    .from('contacts')
    .select('id, contact_type')
    .ilike('email', trimmed)
    .eq('archived', false)
    .limit(1)
    .maybeSingle();
  if (global?.id) {
    return { contactId: global.id, contactType: global.contact_type ?? null, source: 'email' };
  }

  return null;
}

/** LinkedIn URL match — listing-scoped first, then global. */
export async function resolveContactByLinkedInUrl(
  url: string | null | undefined,
  listingId: string | null | undefined,
): Promise<ResolvedContact | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (listingId) {
    const { data: scoped } = await supabase
      .from('contacts')
      .select('id, contact_type')
      .eq('listing_id', listingId)
      .eq('linkedin_url', trimmed)
      .eq('archived', false)
      .limit(1)
      .maybeSingle();
    if (scoped?.id) {
      return { contactId: scoped.id, contactType: scoped.contact_type ?? null, source: 'linkedin' };
    }
  }

  const { data: global } = await supabase
    .from('contacts')
    .select('id, contact_type')
    .eq('linkedin_url', trimmed)
    .eq('archived', false)
    .limit(1)
    .maybeSingle();
  if (global?.id) {
    return { contactId: global.id, contactType: global.contact_type ?? null, source: 'linkedin' };
  }

  return null;
}

/**
 * Fuzzy match the user-entered contact name against the listing's primary
 * contact. Only fires when both first AND last name match (case-insensitive)
 * — too risky to match on first-name alone since multiple contacts share
 * common first names.
 */
export async function resolveContactByFuzzyPrimary(
  contactName: string | null | undefined,
  listingId: string | null | undefined,
): Promise<ResolvedContact | null> {
  if (!contactName || !listingId) return null;
  const parts = contactName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null; // need first + last

  const { data: primary } = await supabase
    .from('contacts')
    .select('id, contact_type, first_name, last_name')
    .eq('listing_id', listingId)
    .eq('is_primary_seller_contact', true)
    .eq('archived', false)
    .limit(1)
    .maybeSingle();

  if (!primary?.id) return null;
  const primaryFirst = (primary.first_name ?? '').toLowerCase().trim();
  const primaryLast = (primary.last_name ?? '').toLowerCase().trim();
  if (!primaryFirst || !primaryLast) return null;
  // Both tokens must appear in the entered name
  const enteredHasFirst = parts.includes(primaryFirst);
  const enteredHasLast = parts.includes(primaryLast);
  if (enteredHasFirst && enteredHasLast) {
    return {
      contactId: primary.id,
      contactType: primary.contact_type ?? null,
      source: 'fuzzy_primary',
    };
  }
  return null;
}

/**
 * Try email → linkedin → fuzzy-primary in order. Return the first match
 * or null. Callers can use the returned `source` to decide whether to
 * surface a "low-confidence attribution" warning.
 */
export async function resolveContact({
  email,
  linkedinUrl,
  contactName,
  listingId,
}: {
  email?: string | null;
  linkedinUrl?: string | null;
  contactName?: string | null;
  listingId?: string | null;
}): Promise<ResolvedContact | null> {
  const byEmail = await resolveContactByEmail(email, listingId);
  if (byEmail) return byEmail;

  const byLinkedIn = await resolveContactByLinkedInUrl(linkedinUrl, listingId);
  if (byLinkedIn) return byLinkedIn;

  const byFuzzy = await resolveContactByFuzzyPrimary(contactName, listingId);
  if (byFuzzy) return byFuzzy;

  return null;
}
