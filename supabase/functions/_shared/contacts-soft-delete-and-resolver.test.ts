/**
 * Regression tests for
 * `supabase/migrations/20260729000000_contacts_soft_delete_and_resolver_archived.sql`.
 *
 * The migration introduces `contacts_soft_delete` and tightens
 * `resolve_contact_identity` / `contacts_upsert` so the three soft-delete
 * conventions on `public.contacts` (`archived`, `deleted_at`, `merged_into_id`)
 * stop diverging in ways that leaked "failed to add contact" errors.
 *
 * The tests re-implement the invariants in pure TypeScript so CI does not
 * need a real Postgres — matches the pattern established in
 * buyer-contact-resolution.test.ts and contacts-hygiene.test.ts.
 */

import { describe, it, expect } from 'vitest';

interface Row {
  id: string;
  email: string | null;
  linkedin_url: string | null;
  archived: boolean;
  deleted_at: string | null;
  merged_into_id: string | null;
  contact_type: 'buyer' | 'seller' | 'advisor' | 'internal' | 'portal_user';
  created_at: string;
}

// ---------------------------------------------------------------------------
// contacts_soft_delete semantics
// ---------------------------------------------------------------------------

class AccessDenied extends Error {
  readonly code = '42501';
}

function simulateSoftDelete(
  table: Row[],
  id: string,
  isAdmin: boolean,
  now: string = new Date().toISOString(),
): Row[] {
  if (!id) throw new Error('contacts_soft_delete: p_contact_id is required');
  if (!isAdmin)
    throw new AccessDenied('Access denied: admin role required to soft-delete contacts');
  return table.map((r) =>
    r.id === id
      ? {
          ...r,
          archived: true,
          deleted_at: r.deleted_at ?? now,
        }
      : r,
  );
}

describe('contacts_soft_delete — RPC semantics', () => {
  const baseRow = (overrides: Partial<Row> = {}): Row => ({
    id: 'c-1',
    email: 'alice@example.com',
    linkedin_url: 'https://linkedin.com/in/alice',
    archived: false,
    deleted_at: null,
    merged_into_id: null,
    contact_type: 'buyer',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });

  it('sets BOTH archived=true AND deleted_at=now()', () => {
    const t = [baseRow()];
    const after = simulateSoftDelete(t, 'c-1', true, '2025-06-01T00:00:00Z');
    expect(after[0].archived).toBe(true);
    expect(after[0].deleted_at).toBe('2025-06-01T00:00:00Z');
  });

  it('preserves an existing deleted_at (coalesce) so audit history survives re-deletes', () => {
    const t = [baseRow({ archived: true, deleted_at: '2024-01-01T00:00:00Z' })];
    const after = simulateSoftDelete(t, 'c-1', true, '2025-06-01T00:00:00Z');
    expect(after[0].deleted_at).toBe('2024-01-01T00:00:00Z');
  });

  it('refuses to run for non-admin callers (42501)', () => {
    const t = [baseRow()];
    expect(() => simulateSoftDelete(t, 'c-1', false)).toThrow(AccessDenied);
  });

  it('refuses when contact_id is missing', () => {
    expect(() => simulateSoftDelete([], '', true)).toThrow(/required/);
  });

  it('is idempotent on an already-deleted row', () => {
    const t = [baseRow({ archived: true, deleted_at: '2024-01-01T00:00:00Z' })];
    const once = simulateSoftDelete(t, 'c-1', true, '2025-06-01T00:00:00Z');
    const twice = simulateSoftDelete(once, 'c-1', true, '2025-07-01T00:00:00Z');
    expect(twice).toEqual(once);
  });

  it('is a no-op for unrelated rows', () => {
    const t = [baseRow(), baseRow({ id: 'c-2', email: 'bob@example.com' })];
    const after = simulateSoftDelete(t, 'c-1', true);
    expect(after[1].archived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolve_contact_identity — archived-row exclusion
// ---------------------------------------------------------------------------

function simulateResolveContactIdentity(
  table: Row[],
  args: {
    email?: string | null;
    linkedin_url?: string | null;
    phone?: string | null;
    firm_id?: string | null;
  },
): string | null {
  const email = args.email?.trim().toLowerCase() || null;
  const linkedin = args.linkedin_url?.trim().toLowerCase() || null;

  const byEmail = (r: Row) =>
    email != null &&
    r.email?.toLowerCase() === email &&
    r.deleted_at == null &&
    r.merged_into_id == null &&
    r.archived === false;

  const byLinkedIn = (r: Row) =>
    linkedin != null &&
    r.linkedin_url?.toLowerCase() === linkedin &&
    r.deleted_at == null &&
    r.merged_into_id == null &&
    r.archived === false;

  const pickOldest = (rows: Row[]) =>
    [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  if (email) {
    const matches = table.filter(byEmail);
    if (matches.length) return pickOldest(matches).id;
  }
  if (linkedin) {
    const matches = table.filter(byLinkedIn);
    if (matches.length) return pickOldest(matches).id;
  }
  return null;
}

describe('resolve_contact_identity — archived=false exclusion', () => {
  const base: Row = {
    id: 'live',
    email: 'alice@example.com',
    linkedin_url: 'https://linkedin.com/in/alice',
    archived: false,
    deleted_at: null,
    merged_into_id: null,
    contact_type: 'buyer',
    created_at: '2025-01-01T00:00:00Z',
  };

  it('does NOT return an archived row by email (post-fix)', () => {
    const table = [{ ...base, archived: true }];
    expect(simulateResolveContactIdentity(table, { email: 'alice@example.com' })).toBeNull();
  });

  it('does NOT return an archived row by linkedin_url (post-fix)', () => {
    const table = [{ ...base, archived: true }];
    expect(
      simulateResolveContactIdentity(table, {
        linkedin_url: 'https://linkedin.com/in/alice',
      }),
    ).toBeNull();
  });

  it('still returns live rows by email', () => {
    expect(simulateResolveContactIdentity([base], { email: 'alice@example.com' })).toBe('live');
  });

  it('prefers the oldest of multiple live matches', () => {
    const older = { ...base, id: 'older', created_at: '2024-01-01T00:00:00Z' };
    expect(simulateResolveContactIdentity([base, older], { email: 'alice@example.com' })).toBe(
      'older',
    );
  });

  it('skips merged tombstones', () => {
    const tomb = { ...base, merged_into_id: 'winner' };
    expect(simulateResolveContactIdentity([tomb], { email: 'alice@example.com' })).toBeNull();
  });

  it('skips soft-deleted rows', () => {
    const tomb = { ...base, deleted_at: '2025-01-01T00:00:00Z' };
    expect(simulateResolveContactIdentity([tomb], { email: 'alice@example.com' })).toBeNull();
  });

  it('prefers email match over linkedin match when both are supplied (legacy ordering preserved)', () => {
    const emailOwner = { ...base, id: 'email-owner' };
    const linkedinOwner = {
      ...base,
      id: 'linkedin-owner',
      email: 'other@example.com',
    };
    expect(
      simulateResolveContactIdentity([emailOwner, linkedinOwner], {
        email: 'alice@example.com',
        linkedin_url: 'https://linkedin.com/in/alice',
      }),
    ).toBe('email-owner');
  });
});

// ---------------------------------------------------------------------------
// contacts_upsert — revive archived on explicit re-add (UPDATE branch)
// ---------------------------------------------------------------------------
//
// Simulates just the "revive archived" behavior of the UPDATE branch in
// 20260729000000. We only re-assert the invariant, not the full body.

function simulateContactsUpsertUpdate(row: Row): Row {
  return {
    ...row,
    // UPDATE always clears archived so an explicit re-add from a writer
    // that predates the resolver-archived-fix doesn't leave a zombie row.
    archived: false,
  };
}

describe('contacts_upsert UPDATE branch — revives archived rows on explicit re-add', () => {
  it('clears archived=false on the UPDATE branch (repair for legacy resolutions)', () => {
    const archived: Row = {
      id: 'c',
      email: 'alice@example.com',
      linkedin_url: null,
      archived: true,
      deleted_at: null, // resolver-archived-fix skips this now, but legacy paths could resolve here
      merged_into_id: null,
      contact_type: 'buyer',
      created_at: '2025-01-01T00:00:00Z',
    };
    const revived = simulateContactsUpsertUpdate(archived);
    expect(revived.archived).toBe(false);
  });
});
