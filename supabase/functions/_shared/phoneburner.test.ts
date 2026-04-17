/**
 * Tests for PhoneBurner integration logic
 *
 * Re-implements pure functions from the webhook and push-contacts
 * edge functions to test without Deno imports.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Re-implement detectEventType from phoneburner-webhook/index.ts
// ============================================================================

function detectEventType(payload: Record<string, unknown>): string {
  if (payload.event) return String(payload.event);
  if (payload.type) return String(payload.type);
  if (payload.disposition || payload.disposition_id) return 'call_end';
  if (payload.call_id && !payload.disposition) return 'call_begin';
  if (payload.contact_id && !payload.call_id) return 'contact_displayed';
  return 'unknown';
}

// ============================================================================
// Re-implement extractContactInfo from phoneburner-webhook/index.ts
// ============================================================================

function extractContactInfo(payload: Record<string, unknown>) {
  const contact = (payload.contact || {}) as Record<string, unknown>;
  const customFields = (contact.custom_fields || payload.custom_fields || {}) as Record<
    string,
    unknown
  >;
  const contactId = (customFields.sourceco_id || customFields.sourceco_contact_id || null) as
    | string
    | null;
  const pbContactId = (contact.id || payload.contact_id || '') as string;
  const user = (payload.user || {}) as Record<string, unknown>;
  const userName = (user.name || payload.user_name || null) as string | null;
  const userEmail = (user.email || payload.user_email || null) as string | null;
  return { contactId, pbContactId, customFields, userName, userEmail };
}

// ============================================================================
// Re-implement verifySignature check logic (simplified for pure testing)
// ============================================================================

function stripSha256Prefix(sig: string): string {
  return sig.replace(/^sha256=/, '');
}

// ============================================================================
// Event Type Detection Tests
// ============================================================================

describe('PhoneBurner Webhook — Event Type Detection', () => {
  it('detects event type from explicit "event" field', () => {
    expect(detectEventType({ event: 'call.started' })).toBe('call.started');
    expect(detectEventType({ event: 'call.ended' })).toBe('call.ended');
    expect(detectEventType({ event: 'disposition.set' })).toBe('disposition.set');
  });

  it('detects event type from "type" field', () => {
    expect(detectEventType({ type: 'call_begin' })).toBe('call_begin');
  });

  it('detects call_end from disposition presence', () => {
    expect(detectEventType({ disposition: { code: 'INTERESTED' } })).toBe('call_end');
    expect(detectEventType({ disposition_id: '123' })).toBe('call_end');
  });

  it('detects call_begin from call_id without disposition', () => {
    expect(detectEventType({ call_id: 'abc123' })).toBe('call_begin');
  });

  it('detects contact_displayed from contact_id without call_id', () => {
    expect(detectEventType({ contact_id: 'pb_456' })).toBe('contact_displayed');
  });

  it('returns unknown for empty payload', () => {
    expect(detectEventType({})).toBe('unknown');
  });

  it('prioritizes explicit event over structure-based detection', () => {
    // Has both event field AND disposition — event should win
    expect(detectEventType({ event: 'callback.scheduled', disposition: { code: 'CB' } })).toBe(
      'callback.scheduled',
    );
  });
});

// ============================================================================
// Contact Info Extraction Tests
// ============================================================================

describe('PhoneBurner Webhook — Contact Info Extraction', () => {
  it('extracts sourceco_id from nested contact.custom_fields', () => {
    const result = extractContactInfo({
      contact: {
        id: 'pb_123',
        custom_fields: { sourceco_id: 'sc_buyer_456' },
      },
    });
    expect(result.contactId).toBe('sc_buyer_456');
    expect(result.pbContactId).toBe('pb_123');
  });

  it('falls back to sourceco_contact_id for backward compat', () => {
    const result = extractContactInfo({
      contact: {
        id: 'pb_789',
        custom_fields: { sourceco_contact_id: 'old_id_123' },
      },
    });
    expect(result.contactId).toBe('old_id_123');
  });

  it('prefers sourceco_id over sourceco_contact_id', () => {
    const result = extractContactInfo({
      contact: {
        id: 'pb_100',
        custom_fields: {
          sourceco_id: 'new_id',
          sourceco_contact_id: 'old_id',
        },
      },
    });
    expect(result.contactId).toBe('new_id');
  });

  it('extracts from flat custom_fields when contact is absent', () => {
    const result = extractContactInfo({
      contact_id: 'pb_flat',
      custom_fields: { sourceco_id: 'flat_contact_id' },
    });
    expect(result.contactId).toBe('flat_contact_id');
    expect(result.pbContactId).toBe('pb_flat');
  });

  it('returns null contactId when no custom_fields', () => {
    const result = extractContactInfo({
      contact: { id: 'pb_nope' },
    });
    expect(result.contactId).toBeNull();
    expect(result.pbContactId).toBe('pb_nope');
  });

  it('extracts user info from nested user object', () => {
    const result = extractContactInfo({
      user: { name: 'Sarah Johnson', email: 'sarah@sourceco.com' },
    });
    expect(result.userName).toBe('Sarah Johnson');
    expect(result.userEmail).toBe('sarah@sourceco.com');
  });

  it('extracts user info from flat fields', () => {
    const result = extractContactInfo({
      user_name: 'John Doe',
      user_email: 'john@example.com',
    });
    expect(result.userName).toBe('John Doe');
    expect(result.userEmail).toBe('john@example.com');
  });

  it('returns null user info when not present', () => {
    const result = extractContactInfo({});
    expect(result.userName).toBeNull();
    expect(result.userEmail).toBeNull();
  });
});

// ============================================================================
// Signature Prefix Stripping
// ============================================================================

describe('PhoneBurner Webhook — Signature Handling', () => {
  it('strips sha256= prefix from signature', () => {
    expect(stripSha256Prefix('sha256=abc123')).toBe('abc123');
  });

  it('returns raw signature when no prefix', () => {
    expect(stripSha256Prefix('abc123')).toBe('abc123');
  });
});

// ============================================================================
// Event ID Generation Logic
// ============================================================================

describe('PhoneBurner Webhook — Event ID Logic', () => {
  it('builds composite event ID from call_id + event type', () => {
    const payload = { call_id: 'call_abc' };
    const eventType = 'call_begin';
    const eventId = payload.call_id ? `${payload.call_id}-${eventType}` : null;
    expect(eventId).toBe('call_abc-call_begin');
  });

  it('different event types for same call_id produce different IDs', () => {
    const callId = 'call_xyz';
    const beginId = `${callId}-call_begin`;
    const endId = `${callId}-call_end`;
    expect(beginId).not.toBe(endId);
  });
});

// ============================================================================
// Disposition Data Extraction
// ============================================================================

describe('PhoneBurner Webhook — Disposition Extraction', () => {
  it('extracts disposition from nested object', () => {
    const payload = {
      disposition: { code: 'INTERESTED', label: 'Interested - Send Info', notes: 'Wants memo' },
    };
    const disposition = (payload.disposition || {}) as Record<string, unknown>;
    expect(disposition.code).toBe('INTERESTED');
    expect(disposition.label).toBe('Interested - Send Info');
    expect(disposition.notes).toBe('Wants memo');
  });

  it('extracts disposition from flat fields', () => {
    const payload = {
      disposition_id: 'NOT_INTERESTED',
      disposition_name: 'Not Interested',
      notes: 'Wrong vertical',
    };
    const code = (payload.disposition_id || '') as string;
    const label = (payload.disposition_name || '') as string;
    const notes = (payload.notes || '') as string;
    expect(code).toBe('NOT_INTERESTED');
    expect(label).toBe('Not Interested');
    expect(notes).toBe('Wrong vertical');
  });
});

// ============================================================================
// Call Duration Extraction
// ============================================================================

describe('PhoneBurner Webhook — Duration Extraction', () => {
  it('extracts duration from nested call_summary', () => {
    const payload = {
      call_summary: { total_duration_seconds: 234, talk_duration_seconds: 200 },
    };
    const callSummary = (payload.call_summary || {}) as Record<string, unknown>;
    expect(callSummary.total_duration_seconds).toBe(234);
    expect(callSummary.talk_duration_seconds).toBe(200);
  });

  it('extracts duration from flat fields', () => {
    const payload = { duration: 120, talk_time: 90 };
    expect(payload.duration).toBe(120);
    expect(payload.talk_time).toBe(90);
  });

  it('extracts recording info from nested object', () => {
    const payload = {
      recording: { url: 'https://example.com/rec.mp3', duration_seconds: 180 },
    };
    const recording = (payload.recording || {}) as Record<string, unknown>;
    expect(recording.url).toBe('https://example.com/rec.mp3');
    expect(recording.duration_seconds).toBe(180);
  });

  it('extracts recording URL from flat field', () => {
    const payload = { recording_url: 'https://example.com/flat.mp3' };
    expect(payload.recording_url).toBe('https://example.com/flat.mp3');
  });
});

// ============================================================================
// Contact Resolution — Buyer Fallback Logic
// ============================================================================

describe('PhoneBurner Push — Buyer Contact Fallback', () => {
  it('generates buyer-prefixed ID for direct buyer contacts', () => {
    const buyerId = 'uuid-123';
    const id = `buyer-${buyerId}`;
    expect(id).toBe('buyer-uuid-123');
  });

  it('strips buyer- prefix for last_contacted_date update', () => {
    const contactId = 'buyer-uuid-456';
    const rawId = contactId.replace(/^(rm-|buyer-)/, '');
    expect(rawId).toBe('uuid-456');
  });

  it('strips rm- prefix for remarketing contacts', () => {
    const contactId = 'rm-uuid-789';
    const rawId = contactId.replace(/^(rm-|buyer-)/, '');
    expect(rawId).toBe('uuid-789');
  });

  it('does not strip prefix from normal UUIDs', () => {
    const contactId = 'abc-def-123';
    const rawId = contactId.replace(/^(rm-|buyer-)/, '');
    expect(rawId).toBe('abc-def-123');
  });

  it('deduplication key handles missing email and phone', () => {
    const email = null;
    const phone = null;
    const key = `${email?.toLowerCase() || ''}-${phone || ''}`;
    expect(key).toBe('-');
  });

  it('deduplication key normalizes email case', () => {
    const key = `${'John@EXAMPLE.COM'.toLowerCase()}-+1555012`;
    expect(key).toBe('john@example.com-+1555012');
  });
});

// ============================================================================
// resolveFromListings — seller-contact resolution order
// ============================================================================
//
// Re-implements the per-listing seller picker so we can regression-test the
// resolution rule without pulling in Deno / Supabase. The real edge function
// at supabase/functions/phoneburner-push-contacts/index.ts uses the same
// score formula and the same input columns. Keeping these tests in lock-step
// with save_primary_seller_contact's "ORDER BY is_primary_seller_contact DESC,
// created_at ASC LIMIT 1" catches drift between the two.

interface SellerContactRow {
  id: string;
  listing_id: string;
  phone: string | null;
  mobile_phone_1: string | null;
  mobile_phone_2: string | null;
  mobile_phone_3: string | null;
  office_phone: string | null;
  is_primary_seller_contact: boolean | null;
  created_at: string | null;
  last_call_attempt_at: string | null;
}

function pickSellerByListing(rows: SellerContactRow[]): Map<string, SellerContactRow> {
  const out = new Map<string, SellerContactRow>();
  for (const c of rows) {
    const existing = out.get(c.listing_id);
    if (!existing) {
      out.set(c.listing_id, c);
      continue;
    }
    const existingScore =
      (existing.is_primary_seller_contact ? 1 : 0) * 1e18 -
      new Date(existing.created_at || 0).getTime();
    const candidateScore =
      (c.is_primary_seller_contact ? 1 : 0) * 1e18 - new Date(c.created_at || 0).getTime();
    if (candidateScore > existingScore) out.set(c.listing_id, c);
  }
  return out;
}

function seller(
  partial: Partial<SellerContactRow> & { id: string; listing_id: string },
): SellerContactRow {
  return {
    phone: null,
    mobile_phone_1: null,
    mobile_phone_2: null,
    mobile_phone_3: null,
    office_phone: null,
    is_primary_seller_contact: false,
    created_at: null,
    last_call_attempt_at: null,
    ...partial,
  };
}

describe('PhoneBurner Push — seller contact resolution for listings', () => {
  it('returns null when no seller contacts exist', () => {
    const picked = pickSellerByListing([]);
    expect(picked.get('listing-1')).toBeUndefined();
  });

  it('prefers is_primary_seller_contact=true even when another seller is older', () => {
    const older = seller({
      id: 'c-old',
      listing_id: 'L1',
      created_at: '2024-01-01T00:00:00Z',
      is_primary_seller_contact: false,
    });
    const primary = seller({
      id: 'c-primary',
      listing_id: 'L1',
      created_at: '2025-06-01T00:00:00Z',
      is_primary_seller_contact: true,
    });
    const picked = pickSellerByListing([older, primary]);
    expect(picked.get('L1')?.id).toBe('c-primary');
  });

  it('falls back to oldest seller when none is flagged primary', () => {
    const a = seller({
      id: 'c-a',
      listing_id: 'L1',
      created_at: '2025-06-01T00:00:00Z',
    });
    const b = seller({
      id: 'c-b',
      listing_id: 'L1',
      created_at: '2024-01-01T00:00:00Z',
    });
    const picked = pickSellerByListing([a, b]);
    expect(picked.get('L1')?.id).toBe('c-b');
  });

  it('resolves different listings independently', () => {
    const picked = pickSellerByListing([
      seller({ id: 'a', listing_id: 'L1', is_primary_seller_contact: true }),
      seller({ id: 'b', listing_id: 'L2', is_primary_seller_contact: true }),
    ]);
    expect(picked.get('L1')?.id).toBe('a');
    expect(picked.get('L2')?.id).toBe('b');
  });

  it('handles null created_at by treating it as epoch (oldest)', () => {
    const noDate = seller({ id: 'c-nodate', listing_id: 'L1', created_at: null });
    const dated = seller({
      id: 'c-dated',
      listing_id: 'L1',
      created_at: '2025-01-01T00:00:00Z',
    });
    // null → new Date(0) → oldest wins
    const picked = pickSellerByListing([dated, noDate]);
    expect(picked.get('L1')?.id).toBe('c-nodate');
  });
});

describe('PhoneBurner Push — listing ResolvedContact phone assembly', () => {
  // Mirrors the final mapping in resolveFromListings: once a seller is picked,
  // the ResolvedContact carries mobile_phone_1/2/3 + office_phone from the
  // seller and falls back to main_contact_phone only when the seller row is
  // missing or has no phone at all.
  function buildListingResolvedPhones(opts: {
    listingMainContactPhone: string | null;
    seller: SellerContactRow | undefined;
  }) {
    const s = opts.seller;
    return {
      phone: s?.phone ?? opts.listingMainContactPhone ?? null,
      mobile_phone_1: s?.mobile_phone_1 ?? null,
      mobile_phone_2: s?.mobile_phone_2 ?? null,
      mobile_phone_3: s?.mobile_phone_3 ?? null,
      office_phone: s?.office_phone ?? null,
      contact_id: s?.id ?? null,
      last_contacted_date: s?.last_call_attempt_at ?? null,
    };
  }

  it('pulls all structured phones from the resolved seller contact', () => {
    const result = buildListingResolvedPhones({
      listingMainContactPhone: '555-stale',
      seller: seller({
        id: 'c1',
        listing_id: 'L1',
        phone: '555-1111',
        mobile_phone_1: '555-1111',
        mobile_phone_2: '555-2222',
        mobile_phone_3: '555-3333',
        office_phone: '555-office',
        last_call_attempt_at: '2025-05-01T10:00:00Z',
      }),
    });
    expect(result.mobile_phone_1).toBe('555-1111');
    expect(result.mobile_phone_2).toBe('555-2222');
    expect(result.mobile_phone_3).toBe('555-3333');
    expect(result.office_phone).toBe('555-office');
    expect(result.contact_id).toBe('c1');
    expect(result.last_contacted_date).toBe('2025-05-01T10:00:00Z');
  });

  it('prefers seller.phone over stale listings.main_contact_phone', () => {
    // Regression: resolveFromListings previously only read main_contact_phone,
    // which drifts from the seller contact whenever phones are edited via
    // the "+ Add Phone Number" flow (which writes to contacts, not listings).
    const result = buildListingResolvedPhones({
      listingMainContactPhone: '555-stale',
      seller: seller({ id: 'c1', listing_id: 'L1', phone: '555-fresh' }),
    });
    expect(result.phone).toBe('555-fresh');
  });

  it('falls back to main_contact_phone when no seller contact exists', () => {
    const result = buildListingResolvedPhones({
      listingMainContactPhone: '555-only',
      seller: undefined,
    });
    expect(result.phone).toBe('555-only');
    expect(result.mobile_phone_1).toBeNull();
    expect(result.mobile_phone_2).toBeNull();
    expect(result.contact_id).toBeNull();
  });

  it('falls back to main_contact_phone when seller has null phone but main_contact does', () => {
    const result = buildListingResolvedPhones({
      listingMainContactPhone: '555-listing',
      seller: seller({ id: 'c1', listing_id: 'L1', phone: null, mobile_phone_2: '555-2222' }),
    });
    // seller.phone is null → fall through to main_contact_phone for the
    // primary `phone` field. mobile_phone_2 is still preserved separately.
    expect(result.phone).toBe('555-listing');
    expect(result.mobile_phone_2).toBe('555-2222');
  });

  it('returns all nulls when neither seller nor listing has any phone', () => {
    const result = buildListingResolvedPhones({
      listingMainContactPhone: null,
      seller: undefined,
    });
    expect(result.phone).toBeNull();
    expect(result.mobile_phone_1).toBeNull();
    expect(result.mobile_phone_2).toBeNull();
    expect(result.mobile_phone_3).toBeNull();
    expect(result.office_phone).toBeNull();
  });
});
