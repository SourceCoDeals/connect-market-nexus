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
