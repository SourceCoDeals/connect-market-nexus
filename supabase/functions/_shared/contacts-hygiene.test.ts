/**
 * Tests for the invariants added in
 * `supabase/migrations/20260728000000_contacts_hygiene_primary_and_collision.sql`.
 *
 * Three invariants under test:
 *
 *   1. Cross-buyer email collision — if an email is already tied to a LIVE
 *      buyer-type contact with a different `remarketing_buyer_id`, the
 *      RPC should raise `P0001` instead of silently rebinding the
 *      caller's intent to someone else's contact row.
 *
 *   2. is_primary_at_firm must be unique per (firm_id OR remarketing_buyer_id,
 *      contact_type). Setting a new primary must flip any prior primary at
 *      the same firm/buyer for the same contact_type back to false.
 *
 *   3. archived=true rows must also have deleted_at stamped so the new
 *      partial unique indexes (LinkedIn URL, confidence, etc.) see the
 *      row as "not live" and the admin form can re-add the same person
 *      without hitting a phantom duplicate-key error.
 */

import { describe, it, expect } from 'vitest';

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  contact_type: 'buyer' | 'seller' | 'advisor' | 'internal' | 'portal_user';
  remarketing_buyer_id: string | null;
  firm_id: string | null;
  is_primary_at_firm: boolean;
  archived: boolean;
  deleted_at: string | null;
  merged_into_id: string | null;
  linkedin_url: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 1. Cross-buyer email collision simulation
// ---------------------------------------------------------------------------

class CrossBuyerEmailCollision extends Error {
  public readonly code = 'P0001';
  public readonly hint: string;
  constructor(email: string, existingBuyerId: string) {
    super(`Contact with email ${email} is already attached to buyer ${existingBuyerId}`);
    this.hint = 'Open that buyer and edit the contact there, or merge the two buyer orgs first.';
  }
}

function simulateEmailCollisionGuard(
  table: ContactRow[],
  email: string | null,
  targetBuyerId: string | null,
): void {
  if (!email || !targetBuyerId) return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const existing = table
    .filter(
      (r) =>
        r.email?.toLowerCase() === normalized &&
        r.contact_type === 'buyer' &&
        r.deleted_at == null &&
        r.merged_into_id == null &&
        r.archived === false &&
        r.remarketing_buyer_id != null &&
        r.remarketing_buyer_id !== targetBuyerId,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (existing.length > 0) {
    throw new CrossBuyerEmailCollision(normalized, existing[0].remarketing_buyer_id!);
  }
}

// ---------------------------------------------------------------------------
// 2. is_primary_at_firm uniqueness trigger simulation
// ---------------------------------------------------------------------------

function simulatePrimaryAtFirmTrigger(table: ContactRow[], newRow: ContactRow): ContactRow[] {
  // Trigger only fires when the row is flipped to primary. Scope matches the
  // SQL migration exactly:
  //   - contact_type in buyer/advisor/portal_user
  //   - firm_id set → scope by firm
  //   - firm_id null but remarketing_buyer_id set → scope by buyer
  if (!newRow.is_primary_at_firm) return table;
  if (!['buyer', 'advisor', 'portal_user'].includes(newRow.contact_type)) return table;
  if (newRow.firm_id == null && newRow.remarketing_buyer_id == null) return table;

  return table.map((r) => {
    if (r.id === newRow.id) return r;
    if (r.deleted_at != null || r.merged_into_id != null) return r;
    if (r.contact_type !== newRow.contact_type) return r;
    if (!r.is_primary_at_firm) return r;

    const sameFirm = newRow.firm_id != null && r.firm_id === newRow.firm_id;
    const sameBuyer =
      newRow.firm_id == null &&
      newRow.remarketing_buyer_id != null &&
      r.remarketing_buyer_id === newRow.remarketing_buyer_id;

    if (sameFirm || sameBuyer) {
      return { ...r, is_primary_at_firm: false };
    }
    return r;
  });
}

// ---------------------------------------------------------------------------
// 3. archived → deleted_at backfill simulation
// ---------------------------------------------------------------------------

function backfillDeletedAtFromArchived(
  table: ContactRow[],
  backfillTime = new Date().toISOString(),
): ContactRow[] {
  return table.map((r) =>
    r.archived && r.deleted_at == null ? { ...r, deleted_at: backfillTime } : r,
  );
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function row(partial: Partial<ContactRow> & { id: string }): ContactRow {
  return {
    first_name: 'Test',
    last_name: 'Person',
    email: null,
    contact_type: 'buyer',
    remarketing_buyer_id: null,
    firm_id: null,
    is_primary_at_firm: false,
    archived: false,
    deleted_at: null,
    merged_into_id: null,
    linkedin_url: null,
    created_at: '2025-01-01T00:00:00Z',
    ...partial,
  };
}

const BUYER_A = 'buyer-a-uuid';
const BUYER_B = 'buyer-b-uuid';
const FIRM_X = 'firm-x-uuid';

// ===========================================================================
// Cross-buyer email collision
// ===========================================================================

describe('upsert_buyer_contact — cross-buyer email collision guard', () => {
  it('raises P0001 when the email belongs to another LIVE buyer contact', () => {
    const table = [
      row({
        id: 'existing',
        email: 'john@acme.com',
        contact_type: 'buyer',
        remarketing_buyer_id: BUYER_A,
      }),
    ];

    expect(() => simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_B)).toThrow(
      CrossBuyerEmailCollision,
    );
  });

  it('allows the same email when the target buyer is the SAME as the existing one (update path)', () => {
    const table = [
      row({
        id: 'existing',
        email: 'john@acme.com',
        contact_type: 'buyer',
        remarketing_buyer_id: BUYER_A,
      }),
    ];

    expect(() => simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_A)).not.toThrow();
  });

  it('does not trip on soft-deleted rows with the same email', () => {
    const table = [
      row({
        id: 'tomb',
        email: 'john@acme.com',
        contact_type: 'buyer',
        remarketing_buyer_id: BUYER_A,
        deleted_at: '2025-02-01T00:00:00Z',
      }),
    ];
    expect(() => simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_B)).not.toThrow();
  });

  it('does not trip when the existing contact has no remarketing_buyer_id (bare enrichment)', () => {
    // A bare enrichment-created row with an email but no buyer linkage
    // should be UPDATED by the caller, not rejected. The caller's target
    // buyer will be attached by the email ON CONFLICT DO UPDATE branch.
    const table = [row({ id: 'bare', email: 'john@acme.com', contact_type: 'buyer' })];
    expect(() => simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_B)).not.toThrow();
  });

  it('is case-insensitive on email comparison', () => {
    const table = [
      row({
        id: 'existing',
        email: 'john@acme.com',
        contact_type: 'buyer',
        remarketing_buyer_id: BUYER_A,
      }),
    ];
    expect(() => simulateEmailCollisionGuard(table, 'JOHN@ACME.com', BUYER_B)).toThrow();
  });

  it('ignores seller-type rows with the same email (different namespace)', () => {
    const table = [
      row({
        id: 'seller-contact',
        email: 'john@acme.com',
        contact_type: 'seller',
        remarketing_buyer_id: null,
      }),
    ];
    // Seller contacts are scoped per-listing; the buyer form is allowed to
    // create a buyer-typed row for the same email without collision.
    expect(() => simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_B)).not.toThrow();
  });

  it('includes an actionable HINT so the UI can render a user-friendly message', () => {
    const table = [
      row({
        id: 'existing',
        email: 'john@acme.com',
        contact_type: 'buyer',
        remarketing_buyer_id: BUYER_A,
      }),
    ];
    try {
      simulateEmailCollisionGuard(table, 'john@acme.com', BUYER_B);
    } catch (err) {
      if (err instanceof CrossBuyerEmailCollision) {
        expect(err.code).toBe('P0001');
        expect(err.message).toContain('already attached to buyer');
        expect(err.hint).toContain('Open that buyer');
      } else {
        throw err;
      }
    }
  });
});

// ===========================================================================
// is_primary_at_firm uniqueness
// ===========================================================================

describe('sync_primary_at_firm trigger', () => {
  it('flips a prior primary to false when a new primary lands at the same firm_id', () => {
    const existing = row({
      id: 'old-primary',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });
    const incoming = row({
      id: 'new-primary',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([existing, incoming], incoming);
    expect(result.find((r) => r.id === 'old-primary')?.is_primary_at_firm).toBe(false);
    expect(result.find((r) => r.id === 'new-primary')?.is_primary_at_firm).toBe(true);
  });

  it('scopes by remarketing_buyer_id when firm_id is not yet federated', () => {
    const existing = row({
      id: 'old',
      firm_id: null,
      remarketing_buyer_id: BUYER_A,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });
    const incoming = row({
      id: 'new',
      firm_id: null,
      remarketing_buyer_id: BUYER_A,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([existing, incoming], incoming);
    expect(result.find((r) => r.id === 'old')?.is_primary_at_firm).toBe(false);
  });

  it('does NOT flip primaries at a different firm', () => {
    const other = row({
      id: 'other-firm-primary',
      firm_id: 'other-firm',
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });
    const incoming = row({
      id: 'our-primary',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([other, incoming], incoming);
    expect(result.find((r) => r.id === 'other-firm-primary')?.is_primary_at_firm).toBe(true);
  });

  it('does NOT flip primaries of a different contact_type', () => {
    // Seller primaries live in their own namespace (listing_id-scoped) and
    // are managed by sync_primary_seller_contact. The buyer trigger must
    // not cross-contaminate.
    const seller = row({
      id: 'seller-primary',
      firm_id: FIRM_X,
      contact_type: 'seller',
      is_primary_at_firm: true,
    });
    const incoming = row({
      id: 'buyer-primary',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([seller, incoming], incoming);
    expect(result.find((r) => r.id === 'seller-primary')?.is_primary_at_firm).toBe(true);
  });

  it('ignores soft-deleted primaries (they do not count)', () => {
    const tomb = row({
      id: 'tomb',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
      deleted_at: '2025-01-01T00:00:00Z',
    });
    const incoming = row({
      id: 'new',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([tomb, incoming], incoming);
    // Tomb stays untouched (its is_primary_at_firm is irrelevant — it's
    // deleted), and we don't accidentally revive it by clearing the flag.
    expect(result.find((r) => r.id === 'tomb')?.deleted_at).toBe('2025-01-01T00:00:00Z');
  });

  it('is a no-op when the incoming row is_primary_at_firm=false', () => {
    const existing = row({
      id: 'old',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });
    const incoming = row({
      id: 'new',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: false,
    });

    const result = simulatePrimaryAtFirmTrigger([existing, incoming], incoming);
    expect(result.find((r) => r.id === 'old')?.is_primary_at_firm).toBe(true);
  });

  it('is a no-op when the row has neither firm_id nor remarketing_buyer_id', () => {
    // No firm scope → nothing to be primary at. Avoids clobbering unrelated
    // rows across the whole namespace just because someone set the flag.
    const existing = row({
      id: 'unrelated-primary',
      firm_id: FIRM_X,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });
    const floating = row({
      id: 'floating',
      firm_id: null,
      remarketing_buyer_id: null,
      contact_type: 'buyer',
      is_primary_at_firm: true,
    });

    const result = simulatePrimaryAtFirmTrigger([existing, floating], floating);
    expect(result.find((r) => r.id === 'unrelated-primary')?.is_primary_at_firm).toBe(true);
  });
});

// ===========================================================================
// archived → deleted_at reconciliation
// ===========================================================================

describe('archived → deleted_at backfill', () => {
  it('stamps deleted_at=now() on rows where archived=true and deleted_at IS NULL', () => {
    const now = '2025-06-01T12:00:00Z';
    const before = [
      row({ id: 'a', archived: true, deleted_at: null }),
      row({ id: 'b', archived: false, deleted_at: null }),
      row({ id: 'c', archived: true, deleted_at: '2025-01-01T00:00:00Z' }),
    ];
    const after = backfillDeletedAtFromArchived(before, now);
    expect(after.find((r) => r.id === 'a')?.deleted_at).toBe(now);
    expect(after.find((r) => r.id === 'b')?.deleted_at).toBeNull();
    expect(after.find((r) => r.id === 'c')?.deleted_at).toBe('2025-01-01T00:00:00Z');
  });

  it('is idempotent — running it twice produces the same result', () => {
    const now = '2025-06-01T12:00:00Z';
    const before = [row({ id: 'a', archived: true, deleted_at: null })];
    const once = backfillDeletedAtFromArchived(before, now);
    const twice = backfillDeletedAtFromArchived(once, '2025-07-01T12:00:00Z');
    // Second pass finds nothing to update because deleted_at is no longer null.
    expect(twice).toEqual(once);
  });

  it('does not touch deleted_at on non-archived rows (preserves soft-delete semantics)', () => {
    const before = [row({ id: 'live', archived: false, deleted_at: null })];
    const after = backfillDeletedAtFromArchived(before);
    expect(after.find((r) => r.id === 'live')?.deleted_at).toBeNull();
  });
});
