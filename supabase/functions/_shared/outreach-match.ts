/**
 * Shared contact-matching helpers for outreach sync workers
 * (sync-smartlead-messages, sync-heyreach-messages, and their backfill twins).
 *
 * The rules these helpers enforce:
 *   1. NEVER auto-create contacts. If no match, return null and let the caller
 *      insert into the unmatched queue.
 *   2. Buyer outreach anchors to remarketing_buyer_id (firm). Seller outreach
 *      anchors to listing_id. `advisor` / `internal` contact_types are treated
 *      as unsupported and skipped (they land in the unmatched queue with a
 *      distinct reason code).
 *   3. Matching is case-insensitive for email and URL-normalized for LinkedIn.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type ContactMatch = {
  id: string;
  contact_type: 'buyer' | 'seller' | 'advisor' | 'internal';
  remarketing_buyer_id: string | null;
  listing_id: string | null;
  email: string | null;
  linkedin_url: string | null;
};

/** Shape of anchor fields to persist on an outreach message row. */
export type OutreachAnchor = {
  contact_id: string;
  contact_type: 'buyer' | 'seller';
  remarketing_buyer_id: string | null;
  listing_id: string | null;
};

export type UnmatchedReason =
  | 'no_match' // no contact with this email/linkedin
  | 'unsupported_contact_type' // matched but contact_type is advisor/internal
  | 'missing_identifiers' // external record had no email or linkedin
  | 'missing_anchor'; // matched but contact has no firm (buyer) or listing (seller)

export type MatchResult =
  | { matched: true; anchor: OutreachAnchor }
  | { matched: false; reason: UnmatchedReason };

// ── Normalization ─────────────────────────────────────────────────────────────

/** Lowercase + trim. Returns null for empty strings. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalize a LinkedIn URL for matching:
 *  - lowercase
 *  - strip protocol (https://, http://)
 *  - strip leading www.
 *  - strip trailing slash
 *  - strip query string and fragment
 *
 * Example:
 *   https://www.LinkedIn.com/in/Jane-Doe/?utm=foo → linkedin.com/in/jane-doe
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim().toLowerCase();
  if (cleaned.length === 0) return null;

  // Strip query string and fragment
  const qIdx = cleaned.indexOf('?');
  if (qIdx >= 0) cleaned = cleaned.slice(0, qIdx);
  const hIdx = cleaned.indexOf('#');
  if (hIdx >= 0) cleaned = cleaned.slice(0, hIdx);

  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');

  // Strip leading www.
  cleaned = cleaned.replace(/^www\./, '');

  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');

  return cleaned.length > 0 ? cleaned : null;
}

// ── Contact resolution ────────────────────────────────────────────────────────

/**
 * Look up a contact by email address. Returns null if no match, the contact row
 * if matched. Non-archived contacts only.
 *
 * If multiple contacts share the same email (e.g. one buyer + one seller),
 * prefers in this order: buyer → seller → advisor → internal. This matches the
 * user's mental model: "when I send an email to someone, it's usually a buyer."
 */
export async function findContactByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
): Promise<ContactMatch | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, contact_type, remarketing_buyer_id, listing_id, email, linkedin_url')
    .ilike('email', normalized)
    .eq('archived', false);

  if (error) {
    console.error('[outreach-match] findContactByEmail error:', error.message);
    return null;
  }

  const rows = (data || []) as ContactMatch[];
  if (rows.length === 0) return null;

  // Prefer buyer > seller > advisor > internal when multiple match
  const priority: Record<string, number> = { buyer: 0, seller: 1, advisor: 2, internal: 3 };
  rows.sort((a, b) => (priority[a.contact_type] ?? 99) - (priority[b.contact_type] ?? 99));
  return rows[0];
}

/**
 * Look up a contact by LinkedIn URL. Matching is done on the normalized URL
 * form — both sides (the stored contacts.linkedin_url and the external value)
 * are normalized before comparison.
 *
 * We can't do the normalization in SQL cheaply, so we fetch candidates where
 * the DB column contains the normalized stem, then re-check in JS.
 */
export async function findContactByLinkedInUrl(
  supabase: SupabaseClient,
  url: string | null | undefined,
): Promise<ContactMatch | null> {
  const normalized = normalizeLinkedInUrl(url);
  if (!normalized) return null;

  // linkedin.com/in/jane-doe → 'in/jane-doe' is the unique piece; search by
  // that substring to be robust to stored variations (with/without www, trailing slash).
  const stem = normalized.replace(/^linkedin\.com\//, '');
  if (!stem) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, contact_type, remarketing_buyer_id, listing_id, email, linkedin_url')
    .ilike('linkedin_url', `%${stem}%`)
    .eq('archived', false)
    .limit(10);

  if (error) {
    console.error('[outreach-match] findContactByLinkedInUrl error:', error.message);
    return null;
  }

  const candidates = (data || []) as ContactMatch[];
  if (candidates.length === 0) return null;

  // Re-verify by normalizing each candidate's stored URL and comparing.
  // If no EXACT match, return null. The substring query is only a prefilter;
  // returning the loose best-guess could attach messages to the wrong person
  // (e.g. `in/john-smith` substring-matches `in/john-smith-advisor`).
  const exactMatches = candidates.filter(
    (c) => normalizeLinkedInUrl(c.linkedin_url) === normalized,
  );
  if (exactMatches.length === 0) return null;

  const priority: Record<string, number> = { buyer: 0, seller: 1, advisor: 2, internal: 3 };
  exactMatches.sort((a, b) => (priority[a.contact_type] ?? 99) - (priority[b.contact_type] ?? 99));
  return exactMatches[0];
}

// ── Anchor routing ────────────────────────────────────────────────────────────

/**
 * Given a matched contact, build the anchor fields for an outreach_messages row.
 *
 * Design contract (per spec):
 *   Buyer outreach  → contact + firm (remarketing_buyer_id must be non-null)
 *   Seller outreach → contact + listing (listing_id must be non-null)
 *
 * If a buyer contact has no firm affiliation, or a seller contact has no
 * listing, we park in the unmatched queue with reason `missing_anchor`. The
 * record can later be promoted when the anchor is populated on the contact.
 *
 * Advisor / internal contact_types are always unsupported.
 */
export function buildAnchorFromContact(contact: ContactMatch): MatchResult {
  if (contact.contact_type === 'buyer') {
    if (!contact.remarketing_buyer_id) {
      // Unaffiliated buyer — per spec, buyer outreach tracks at the firm level.
      // Park in unmatched until the contact is linked to a firm.
      return { matched: false, reason: 'missing_anchor' };
    }
    return {
      matched: true,
      anchor: {
        contact_id: contact.id,
        contact_type: 'buyer',
        remarketing_buyer_id: contact.remarketing_buyer_id,
        listing_id: null,
      },
    };
  }
  if (contact.contact_type === 'seller') {
    if (!contact.listing_id) {
      // Seller with no listing — per spec, seller outreach tracks at the deal
      // level. Park until the contact is linked to a listing.
      return { matched: false, reason: 'missing_anchor' };
    }
    return {
      matched: true,
      anchor: {
        contact_id: contact.id,
        contact_type: 'seller',
        remarketing_buyer_id: null,
        listing_id: contact.listing_id,
      },
    };
  }
  return { matched: false, reason: 'unsupported_contact_type' };
}

/**
 * Full resolution: tries email first, then LinkedIn. Returns either the anchor
 * fields (for insertion into smartlead_messages / heyreach_messages) or the
 * reason it couldn't be resolved (for insertion into the unmatched queue).
 */
export async function resolveOutreachContact(
  supabase: SupabaseClient,
  signals: { email?: string | null; linkedin_url?: string | null },
): Promise<MatchResult> {
  const email = normalizeEmail(signals.email);
  const linkedin = normalizeLinkedInUrl(signals.linkedin_url);

  if (!email && !linkedin) {
    return { matched: false, reason: 'missing_identifiers' };
  }

  // Email first (more reliable when present)
  if (email) {
    const contact = await findContactByEmail(supabase, email);
    if (contact) return buildAnchorFromContact(contact);
  }

  // LinkedIn fallback
  if (linkedin) {
    const contact = await findContactByLinkedInUrl(supabase, linkedin);
    if (contact) return buildAnchorFromContact(contact);
  }

  return { matched: false, reason: 'no_match' };
}

// ── Auth helper for sync workers ──────────────────────────────────────────────

/**
 * Verify the caller is allowed to invoke this sync function.
 *
 * Accepts any of:
 *   - Authorization: Bearer <CRON_SECRET>         (explicit cron secret)
 *   - Authorization: Bearer <SERVICE_ROLE_KEY>    (matches the pg_cron pattern
 *                                                   used by sync-captarget-sheet
 *                                                   and other existing cron jobs)
 *   - X-Cron-Secret: <CRON_SECRET>                (manual curl convenience)
 *
 * Returns true if authorized, false otherwise. Callers should respond 401 on false.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!cronSecret && !serviceRoleKey) {
    console.warn(
      '[outreach-match] No CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY — rejecting all requests',
    );
    return false;
  }

  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const cronHeader = req.headers.get('x-cron-secret') || '';

  if (cronSecret) {
    if (timingSafeEqual(bearer, cronSecret)) return true;
    if (timingSafeEqual(cronHeader, cronSecret)) return true;
  }
  if (serviceRoleKey && timingSafeEqual(bearer, serviceRoleKey)) return true;

  return false;
}

/** Constant-time string comparison to avoid timing side-channel leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
