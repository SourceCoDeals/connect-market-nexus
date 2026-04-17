/**
 * Tests for buyer contact resolution order used by upsert_buyer_contact.
 *
 * These tests re-implement the resolution priority (pure TypeScript) so the
 * regression guard can run without Postgres. They pin the intended behaviour
 * of `supabase/migrations/20260727000000_upsert_buyer_contact_linkedin_conflict.sql`
 * against the real-world scenarios that surfaced during the Stonegrove
 * Roofing Partners / Strand Equity "Failed to add contact" bug:
 *
 *   1. A contact with a LinkedIn URL that already exists globally on any
 *      live contact row (including seller / advisor rows and archived-but-
 *      not-soft-deleted rows) must NOT raise
 *      `duplicate key value violates unique constraint
 *       "idx_contacts_linkedin_url_unique"`.
 *   2. The admin form must never be able to create two rows for the same
 *      LinkedIn URL, no matter which resolution branch the RPC enters
 *      (email / name-keyed upsert vs. LinkedIn-keyed upsert).
 *   3. When a LinkedIn URL matches a bare enrichment-created row (no buyer
 *      linkage, no firm), the admin's submission should attach both the
 *      remarketing_buyer_id AND firm_id to that row — so the existing
 *      unified contact graph wins and a duplicate is not created.
 *   4. The stale 10-arg upsert_buyer_contact overload must be dropped so
 *      PostgREST cannot route to the LinkedIn-unaware code path.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implemented resolution order (matches 20260727000000 exactly)
// ---------------------------------------------------------------------------

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  title: string | null;
  contact_type: 'buyer' | 'seller' | 'advisor' | 'internal' | 'portal_user';
  remarketing_buyer_id: string | null;
  firm_id: string | null;
  archived: boolean;
  deleted_at: string | null;
  merged_into_id: string | null;
  is_primary_at_firm: boolean;
  mobile_phone_1: string | null;
  mobile_phone_2: string | null;
  mobile_phone_3: string | null;
  office_phone: string | null;
  phone_source: string | null;
  created_at: string;
}

interface UpsertInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  is_primary_at_firm?: boolean;
  remarketing_buyer_id?: string | null;
  firm_id?: string | null;
  source?: string;
  mobile_phone_1?: string | null;
  mobile_phone_2?: string | null;
  mobile_phone_3?: string | null;
  office_phone?: string | null;
  phone_source?: string | null;
}

type UpsertResult =
  | { branch: 'linkedin_update'; row: ContactRow }
  | { branch: 'email_insert' | 'email_update'; row: ContactRow }
  | { branch: 'name_buyer_insert' | 'name_buyer_update'; row: ContactRow }
  | { branch: 'name_only_insert' | 'name_only_update'; row: ContactRow };

function trim(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function lower(v: string | null): string | null {
  return v == null ? null : v.toLowerCase();
}

function simulateUpsertBuyerContact(table: ContactRow[], input: UpsertInput): UpsertResult {
  const email = lower(trim(input.email ?? null));
  const linkedin = trim(input.linkedin_url ?? null);

  // Step 0: LinkedIn resolution — runs before email/name branches.
  if (linkedin) {
    const live = table
      .filter(
        (r) =>
          r.linkedin_url != null &&
          r.linkedin_url.toLowerCase() === linkedin.toLowerCase() &&
          r.deleted_at == null &&
          r.merged_into_id == null,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (live.length > 0) {
      const row = live[0];
      row.first_name = trim(input.first_name) ?? row.first_name;
      row.last_name = input.last_name ?? row.last_name;
      row.email = row.email ?? email;
      row.phone = row.phone ?? trim(input.phone ?? null);
      row.title = row.title ?? trim(input.title ?? null);
      row.remarketing_buyer_id = row.remarketing_buyer_id ?? input.remarketing_buyer_id ?? null;
      row.firm_id = row.firm_id ?? input.firm_id ?? null;
      row.is_primary_at_firm = row.is_primary_at_firm || !!input.is_primary_at_firm;
      row.mobile_phone_1 = row.mobile_phone_1 ?? trim(input.mobile_phone_1 ?? null);
      row.mobile_phone_2 = row.mobile_phone_2 ?? trim(input.mobile_phone_2 ?? null);
      row.mobile_phone_3 = row.mobile_phone_3 ?? trim(input.mobile_phone_3 ?? null);
      row.office_phone = row.office_phone ?? trim(input.office_phone ?? null);
      row.archived = false;
      return { branch: 'linkedin_update', row };
    }
  }

  // Step 1: email branch (upsert by email)
  if (email) {
    const existing = table.find(
      (r) =>
        r.email?.toLowerCase() === email &&
        r.contact_type === 'buyer' &&
        r.email != null &&
        r.archived === false,
    );
    if (existing) {
      existing.first_name = input.first_name;
      existing.last_name = input.last_name;
      existing.remarketing_buyer_id =
        existing.remarketing_buyer_id ?? input.remarketing_buyer_id ?? null;
      existing.firm_id = existing.firm_id ?? input.firm_id ?? null;
      existing.linkedin_url = existing.linkedin_url ?? linkedin;
      return { branch: 'email_update', row: existing };
    }
    const row = buildNewRow(input, 'buyer', { email, linkedin });
    table.push(row);
    return { branch: 'email_insert', row };
  }

  // Step 2: name + buyer branch
  if (input.remarketing_buyer_id) {
    const existing = table.find(
      (r) =>
        r.first_name.trim().toLowerCase() === input.first_name.trim().toLowerCase() &&
        r.last_name.trim().toLowerCase() === input.last_name.trim().toLowerCase() &&
        r.remarketing_buyer_id === input.remarketing_buyer_id &&
        r.contact_type === 'buyer' &&
        r.email == null &&
        r.archived === false,
    );
    if (existing) {
      return { branch: 'name_buyer_update', row: existing };
    }
    const row = buildNewRow(input, 'buyer', { email: null, linkedin });
    table.push(row);
    return { branch: 'name_buyer_insert', row };
  }

  // Step 3: name-only branch
  const existing = table.find(
    (r) =>
      r.first_name.trim().toLowerCase() === input.first_name.trim().toLowerCase() &&
      r.last_name.trim().toLowerCase() === input.last_name.trim().toLowerCase() &&
      r.contact_type === 'buyer' &&
      r.email == null &&
      r.remarketing_buyer_id == null &&
      r.archived === false,
  );
  if (existing) {
    return { branch: 'name_only_update', row: existing };
  }
  const row = buildNewRow(input, 'buyer', { email: null, linkedin });
  table.push(row);
  return { branch: 'name_only_insert', row };
}

function buildNewRow(
  input: UpsertInput,
  contactType: ContactRow['contact_type'],
  keys: { email: string | null; linkedin: string | null },
): ContactRow {
  return {
    id: crypto.randomUUID(),
    first_name: input.first_name,
    last_name: input.last_name,
    email: keys.email,
    phone: trim(input.phone ?? null),
    linkedin_url: keys.linkedin,
    title: trim(input.title ?? null),
    contact_type: contactType,
    remarketing_buyer_id: input.remarketing_buyer_id ?? null,
    firm_id: input.firm_id ?? null,
    archived: false,
    deleted_at: null,
    merged_into_id: null,
    is_primary_at_firm: !!input.is_primary_at_firm,
    mobile_phone_1: trim(input.mobile_phone_1 ?? null),
    mobile_phone_2: trim(input.mobile_phone_2 ?? null),
    mobile_phone_3: trim(input.mobile_phone_3 ?? null),
    office_phone: trim(input.office_phone ?? null),
    phone_source: trim(input.phone_source ?? null),
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Simulates the UNIQUE constraint raise from idx_contacts_linkedin_url_unique
// so the tests below can prove the resolution order prevents the clash.
// ---------------------------------------------------------------------------

function wouldRaiseLinkedinUnique(table: ContactRow[], linkedin: string | null) {
  if (!linkedin) return false;
  const seen = table.filter(
    (r) =>
      r.linkedin_url != null &&
      r.linkedin_url.toLowerCase() === linkedin.toLowerCase() &&
      r.deleted_at == null &&
      r.merged_into_id == null,
  );
  return seen.length > 1; // more than one live row with same URL
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function makeExistingBareEnrichment(linkedin: string): ContactRow {
  return {
    id: 'existing-bare',
    first_name: 'Carson',
    last_name: 'Cooper',
    email: null,
    phone: null,
    linkedin_url: linkedin,
    title: null,
    contact_type: 'buyer',
    remarketing_buyer_id: null,
    firm_id: null,
    archived: false,
    deleted_at: null,
    merged_into_id: null,
    is_primary_at_firm: false,
    mobile_phone_1: null,
    mobile_phone_2: null,
    mobile_phone_3: null,
    office_phone: null,
    phone_source: null,
    created_at: '2025-03-15T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const LINKEDIN_URL = 'https://www.linkedin.com/in/carson-cooper-449976134/';
const BUYER_ID = 'buyer-uuid-stonegrove';
const FIRM_ID = 'firm-uuid-strand-equity';

describe('upsert_buyer_contact — LinkedIn URL conflict resolution', () => {
  it('updates the existing bare enrichment row instead of raising unique-violation', () => {
    // This is the Stonegrove Roofing Partners screenshot scenario: auto-
    // discovery / domain tracking already created a LinkedIn-only row for
    // Carson Cooper. Admin then manually adds him with the same LinkedIn
    // URL plus email / phone / role. Pre-fix: unique violation on
    // idx_contacts_linkedin_url_unique → generic "Failed to add contact".
    const table: ContactRow[] = [makeExistingBareEnrichment(LINKEDIN_URL)];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      email: 'carson@stonegrovellc.com',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
      firm_id: FIRM_ID,
      mobile_phone_1: '(555) 123-4567',
      title: 'Managing Partner',
    });

    expect(result.branch).toBe('linkedin_update');
    expect(result.row.id).toBe('existing-bare'); // reused the enrichment row
    expect(result.row.email).toBe('carson@stonegrovellc.com');
    expect(result.row.remarketing_buyer_id).toBe(BUYER_ID);
    expect(result.row.firm_id).toBe(FIRM_ID);
    expect(result.row.mobile_phone_1).toBe('(555) 123-4567');
    expect(result.row.title).toBe('Managing Partner');
    expect(wouldRaiseLinkedinUnique(table, LINKEDIN_URL)).toBe(false);
    expect(table.length).toBe(1); // did not insert a duplicate
  });

  it('merges into a seller-typed contact with the same LinkedIn URL (cross-type)', () => {
    // idx_contacts_linkedin_url_unique is NOT filtered by contact_type, so
    // a seller row with the same LinkedIn would have tripped the old
    // ON CONFLICT branches. Verify we dedupe onto that row even though
    // contact_type differs.
    const table: ContactRow[] = [
      {
        ...makeExistingBareEnrichment(LINKEDIN_URL),
        id: 'seller-existing',
        contact_type: 'seller',
      },
    ];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      email: 'carson@stonegrovellc.com',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
    });

    expect(result.branch).toBe('linkedin_update');
    expect(result.row.id).toBe('seller-existing');
    // Type is preserved — we do not downgrade a seller to a buyer just
    // because this UI pushed us through.
    expect(result.row.contact_type).toBe('seller');
    // But the buyer linkage is added so both flows can find the row.
    expect(result.row.remarketing_buyer_id).toBe(BUYER_ID);
    expect(wouldRaiseLinkedinUnique(table, LINKEDIN_URL)).toBe(false);
  });

  it('prefers LinkedIn dedupe over email-keyed INSERT when both are provided', () => {
    // If a LinkedIn-only row exists AND the caller supplies both a new
    // email and that LinkedIn URL, the RPC should merge into the existing
    // LinkedIn row and adopt the new email — not create a second row via
    // the email INSERT branch (which would violate the LinkedIn index).
    const table: ContactRow[] = [makeExistingBareEnrichment(LINKEDIN_URL)];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      email: 'carson@new-email.com',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
    });

    expect(result.branch).toBe('linkedin_update');
    expect(result.row.email).toBe('carson@new-email.com');
    expect(table.length).toBe(1);
  });

  it('inserts a fresh row when no LinkedIn match exists and no email provided', () => {
    const table: ContactRow[] = [];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
    });

    expect(result.branch).toBe('name_buyer_insert');
    expect(result.row.linkedin_url).toBe(LINKEDIN_URL);
    expect(table.length).toBe(1);
  });

  it('inserts via email branch when LinkedIn URL is absent and no email dedupe target exists', () => {
    const table: ContactRow[] = [];
    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      email: 'carson@stonegrovellc.com',
      remarketing_buyer_id: BUYER_ID,
    });
    expect(result.branch).toBe('email_insert');
    expect(result.row.email).toBe('carson@stonegrovellc.com');
  });

  it('does NOT resolve onto a soft-deleted row (deleted_at IS NOT NULL)', () => {
    // The unique index excludes soft-deleted rows via
    // `deleted_at IS NULL AND merged_into_id IS NULL`, so a fresh insert
    // with the same LinkedIn URL must be legal. The resolution logic uses
    // the same predicate to avoid reviving tombstones.
    const table: ContactRow[] = [
      {
        ...makeExistingBareEnrichment(LINKEDIN_URL),
        deleted_at: '2025-01-01T00:00:00Z',
      },
    ];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
      email: 'carson@stonegrovellc.com',
    });

    expect(['email_insert', 'linkedin_update']).toContain(result.branch);
    if (result.branch === 'linkedin_update') {
      // Shouldn't have picked the tombstone — this branch would be a bug.
      expect(result.row.deleted_at).toBeNull();
    }
    // Either way, the new insert must not clash with the index.
    expect(wouldRaiseLinkedinUnique(table, LINKEDIN_URL)).toBe(false);
  });

  it('picks the oldest live LinkedIn match when two exist (deterministic)', () => {
    // Defensive: the unique index should prevent two live rows with the
    // same LinkedIn URL from existing, but if the index was disabled
    // during a backfill the resolver should still behave deterministically.
    const table: ContactRow[] = [
      {
        ...makeExistingBareEnrichment(LINKEDIN_URL),
        id: 'old',
        created_at: '2025-01-01T00:00:00Z',
      },
      {
        ...makeExistingBareEnrichment(LINKEDIN_URL),
        id: 'new',
        created_at: '2025-09-01T00:00:00Z',
      },
    ];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
    });

    expect(result.branch).toBe('linkedin_update');
    expect(result.row.id).toBe('old');
  });

  it('treats an archived-but-not-soft-deleted row as a live LinkedIn match and clears the archive flag', () => {
    // Older rows can be archived=true with deleted_at=null (legacy
    // soft-delete scheme). The new LinkedIn unique index still counts
    // those rows as live. If the admin re-adds the person, the resolver
    // should revive the archived row rather than fail with a duplicate.
    const archived: ContactRow = {
      ...makeExistingBareEnrichment(LINKEDIN_URL),
      archived: true,
      deleted_at: null,
    };
    const table: ContactRow[] = [archived];

    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      linkedin_url: LINKEDIN_URL,
      remarketing_buyer_id: BUYER_ID,
    });

    expect(result.branch).toBe('linkedin_update');
    expect(result.row.archived).toBe(false);
  });

  it('normalizes LinkedIn URL casing when matching (linkedin.com is case-insensitive)', () => {
    const table: ContactRow[] = [
      makeExistingBareEnrichment('https://www.linkedin.com/in/Carson-Cooper-449976134/'),
    ];
    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      linkedin_url: 'https://www.linkedin.com/in/carson-cooper-449976134/',
      remarketing_buyer_id: BUYER_ID,
    });
    expect(result.branch).toBe('linkedin_update');
  });

  it('handles whitespace-only linkedin_url as null (no resolution)', () => {
    const table: ContactRow[] = [];
    const result = simulateUpsertBuyerContact(table, {
      first_name: 'Carson',
      last_name: 'Cooper',
      email: 'carson@stonegrovellc.com',
      linkedin_url: '   ',
      remarketing_buyer_id: BUYER_ID,
    });
    expect(result.branch).toBe('email_insert');
    expect(result.row.linkedin_url).toBeNull();
  });
});
