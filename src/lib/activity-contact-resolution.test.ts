/**
 * Tests for the contact-resolution helpers used by LogManualTouchDialog
 * (Fix #3) and UnmatchedActivitiesPage (Fix #2).
 *
 * The resolvers themselves issue Supabase queries — to keep these unit
 * tests pure we mock the supabase client at module level. The fuzzy-name
 * matcher is the most logic-dense piece (token-level case-insensitive
 * compare); we exercise it directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client BEFORE importing the module under test so the
// resolver picks up the stub. Each query path is built in tests via the
// `__setNextResult` helper.
type StubResult<T = unknown> = { data: T | null; error: null };
const mockResults: StubResult[] = [];

function __pushResult<T>(r: StubResult<T>) {
  mockResults.push(r as StubResult);
}

function buildBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = ['select', 'eq', 'ilike', 'order', 'limit', 'is', 'in'] as const;
  for (const m of chain) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => mockResults.shift() ?? { data: null, error: null });
  builder.single = builder.maybeSingle;
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => buildBuilder()),
    auth: { getUser: vi.fn() },
  },
  untypedFrom: vi.fn(() => buildBuilder()),
}));

import {
  resolveContactByEmail,
  resolveContactByLinkedInUrl,
  resolveContactByFuzzyPrimary,
  resolveContact,
} from './activity-contact-resolution';

beforeEach(() => {
  mockResults.length = 0;
});

describe('resolveContactByEmail', () => {
  it('returns null for null/empty/malformed email input', async () => {
    expect(await resolveContactByEmail(null, 'list-1')).toBeNull();
    expect(await resolveContactByEmail('', 'list-1')).toBeNull();
    expect(await resolveContactByEmail('not-an-email', 'list-1')).toBeNull();
  });

  it('returns the listing-scoped match when one exists', async () => {
    __pushResult({ data: { id: 'c-scoped', contact_type: 'buyer' }, error: null });
    const r = await resolveContactByEmail('alex@example.com', 'list-1');
    expect(r).toEqual({ contactId: 'c-scoped', contactType: 'buyer', source: 'email' });
  });

  it('falls through to global match when listing-scoped misses', async () => {
    __pushResult({ data: null, error: null }); // listing-scoped miss
    __pushResult({ data: { id: 'c-global', contact_type: 'seller' }, error: null });
    const r = await resolveContactByEmail('alex@example.com', 'list-1');
    expect(r).toEqual({ contactId: 'c-global', contactType: 'seller', source: 'email' });
  });

  it('returns null when both listing-scoped and global miss', async () => {
    __pushResult({ data: null, error: null });
    __pushResult({ data: null, error: null });
    const r = await resolveContactByEmail('nope@example.com', 'list-1');
    expect(r).toBeNull();
  });
});

describe('resolveContactByLinkedInUrl', () => {
  it('returns null for empty URL', async () => {
    expect(await resolveContactByLinkedInUrl(null, 'list-1')).toBeNull();
    expect(await resolveContactByLinkedInUrl('', 'list-1')).toBeNull();
    expect(await resolveContactByLinkedInUrl('   ', 'list-1')).toBeNull();
  });

  it('hits listing-scoped first', async () => {
    __pushResult({ data: { id: 'c-scoped', contact_type: 'buyer' }, error: null });
    const r = await resolveContactByLinkedInUrl('https://linkedin.com/in/alexchen', 'list-1');
    expect(r).toEqual({ contactId: 'c-scoped', contactType: 'buyer', source: 'linkedin' });
  });
});

describe('resolveContactByFuzzyPrimary', () => {
  it('rejects when contact name has fewer than 2 tokens', async () => {
    expect(await resolveContactByFuzzyPrimary('Sarah', 'list-1')).toBeNull();
    expect(await resolveContactByFuzzyPrimary(' ', 'list-1')).toBeNull();
    expect(await resolveContactByFuzzyPrimary(null, 'list-1')).toBeNull();
  });

  it('rejects when listingId missing', async () => {
    expect(await resolveContactByFuzzyPrimary('Sarah Chen', null)).toBeNull();
  });

  it('matches when both first AND last token appear in user input', async () => {
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: 'Sarah',
        last_name: 'Chen',
      },
      error: null,
    });
    const r = await resolveContactByFuzzyPrimary('sarah chen', 'list-1');
    expect(r).toEqual({
      contactId: 'c-primary',
      contactType: 'seller',
      source: 'fuzzy_primary',
    });
  });

  it('rejects when only first name matches (the dangerous case)', async () => {
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: 'Sarah',
        last_name: 'Chen',
      },
      error: null,
    });
    const r = await resolveContactByFuzzyPrimary('sarah taylor', 'list-1');
    expect(r).toBeNull();
  });

  it('rejects when only last name matches', async () => {
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: 'Sarah',
        last_name: 'Chen',
      },
      error: null,
    });
    const r = await resolveContactByFuzzyPrimary('mary chen', 'list-1');
    expect(r).toBeNull();
  });

  it('handles case-insensitive comparison', async () => {
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: 'SARAH',
        last_name: 'chen',
      },
      error: null,
    });
    const r = await resolveContactByFuzzyPrimary('Sarah CHEN', 'list-1');
    expect(r?.contactId).toBe('c-primary');
  });

  it('returns null when no primary contact exists', async () => {
    __pushResult({ data: null, error: null });
    const r = await resolveContactByFuzzyPrimary('sarah chen', 'list-1');
    expect(r).toBeNull();
  });

  it('returns null when primary has empty name fields', async () => {
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: '',
        last_name: '',
      },
      error: null,
    });
    const r = await resolveContactByFuzzyPrimary('sarah chen', 'list-1');
    expect(r).toBeNull();
  });
});

describe('resolveContact (priority chain)', () => {
  it('email wins over linkedin and fuzzy', async () => {
    __pushResult({ data: { id: 'c-email', contact_type: 'buyer' }, error: null });
    const r = await resolveContact({
      email: 'alex@example.com',
      linkedinUrl: 'https://linkedin.com/in/anyone',
      contactName: 'Mary Smith',
      listingId: 'list-1',
    });
    expect(r?.source).toBe('email');
    expect(r?.contactId).toBe('c-email');
  });

  it('falls through email → linkedin', async () => {
    __pushResult({ data: null, error: null }); // email listing miss
    __pushResult({ data: null, error: null }); // email global miss
    __pushResult({ data: { id: 'c-li', contact_type: 'buyer' }, error: null }); // linkedin listing hit
    const r = await resolveContact({
      email: 'alex@example.com',
      linkedinUrl: 'https://linkedin.com/in/alexchen',
      listingId: 'list-1',
    });
    expect(r?.source).toBe('linkedin');
  });

  it('falls through to fuzzy primary as last resort', async () => {
    __pushResult({ data: null, error: null }); // email listing miss
    __pushResult({ data: null, error: null }); // email global miss
    __pushResult({ data: null, error: null }); // linkedin listing miss
    __pushResult({ data: null, error: null }); // linkedin global miss
    __pushResult({
      data: {
        id: 'c-primary',
        contact_type: 'seller',
        first_name: 'Sarah',
        last_name: 'Chen',
      },
      error: null,
    });
    const r = await resolveContact({
      email: 'wrong@example.com',
      linkedinUrl: 'https://linkedin.com/in/wrong',
      contactName: 'Sarah Chen',
      listingId: 'list-1',
    });
    expect(r?.source).toBe('fuzzy_primary');
  });

  it('returns null when nothing matches', async () => {
    __pushResult({ data: null, error: null });
    __pushResult({ data: null, error: null });
    __pushResult({ data: null, error: null });
    __pushResult({ data: null, error: null });
    __pushResult({ data: null, error: null });
    const r = await resolveContact({
      email: 'unknown@example.com',
      linkedinUrl: 'https://linkedin.com/in/unknown',
      contactName: 'No Match',
      listingId: 'list-1',
    });
    expect(r).toBeNull();
  });
});
