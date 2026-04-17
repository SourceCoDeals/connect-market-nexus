/**
 * rematch-unmatched-activities
 *
 * Admin-triggered rescan of the three unmatched queues:
 *   1. contact_activities  WHERE contact_id IS NULL AND source_system='phoneburner'
 *   2. smartlead_unmatched_messages  WHERE matched_at IS NULL
 *   3. heyreach_unmatched_messages   WHERE matched_at IS NULL
 *
 * For each unmatched record, try email / LinkedIn / phone matching against the
 * current `contacts` table (contacts may have been added since the activity
 * was originally logged). If a match is found, promote the record to its
 * canonical location and mark it resolved.
 *
 * PhoneBurner path: updates contact_activities.contact_id + remarketing_buyer_id
 *                   + listing_id in place.
 * SmartLead path:   calls promote_unmatched_outreach_for_contact() for each
 *                   candidate contact — leverages the existing promotion
 *                   function + trigger logic.
 * HeyReach path:    same as SmartLead.
 *
 * Invocation: POST /functions/v1/rematch-unmatched-activities
 *   Body (all optional):
 *     { channel: 'phoneburner' | 'smartlead' | 'heyreach' | 'all' }  (default 'all')
 *     { max_rows: <n> }   (default 2000, hard cap 10000)
 *     { dry_run: true }   (report matches without updating)
 *
 * Admin-only: requires a valid admin JWT or the CRON_SECRET.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest, normalizeEmail } from '../_shared/outreach-match.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

type Channel = 'phoneburner' | 'smartlead' | 'heyreach' | 'all';

interface ReqBody {
  channel?: Channel;
  max_rows?: number;
  dry_run?: boolean;
}

interface RematchSummary {
  channel: string;
  scanned: number;
  matched: number;
  updated: number;
  errors: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Admin-or-cron auth. The shared helper accepts service_role JWTs, CRON_SECRET,
  // or an x-cron-secret header — all appropriate for an ops-triggered rematch.
  if (!isAuthorizedCronRequest(req)) {
    // Fall back to per-user admin check via the user's JWT. This lets an admin
    // kick a rematch from the UI without needing CRON_SECRET in the browser.
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdminData } = await userClient.rpc('is_admin', { user_id: userData.user.id });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: ReqBody = {};
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    // No body — defaults
  }

  const channel: Channel = body.channel || 'all';
  const maxRows = Math.min(Math.max(body.max_rows || 2000, 1), 10000);
  const dryRun = body.dry_run === true;

  const summaries: RematchSummary[] = [];
  const startedAt = Date.now();

  if (channel === 'all' || channel === 'phoneburner') {
    summaries.push(await rematchPhoneBurner(supabase, maxRows, dryRun));
  }
  if (channel === 'all' || channel === 'smartlead') {
    summaries.push(await rematchOutreach(supabase, 'smartlead', maxRows, dryRun));
  }
  if (channel === 'all' || channel === 'heyreach') {
    summaries.push(await rematchOutreach(supabase, 'heyreach', maxRows, dryRun));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run: dryRun,
      duration_ms: Date.now() - startedAt,
      per_channel: summaries,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

// -----------------------------------------------------------------------------
// PhoneBurner rematch — update contact_activities in place.
// -----------------------------------------------------------------------------
// Strategy: batch-load unmatched rows with a non-null contact_email, batch-load
// their candidate contacts by email in one query, map back in JS, and update
// in per-row UPDATEs (grouping UPDATEs by contact_id would reduce round-trips
// but complicates the listing_id/remarketing_buyer_id assignment).
async function rematchPhoneBurner(
  supabase: SupabaseClient,
  maxRows: number,
  dryRun: boolean,
): Promise<RematchSummary> {
  const summary: RematchSummary = {
    channel: 'phoneburner',
    scanned: 0,
    matched: 0,
    updated: 0,
    errors: 0,
  };

  const { data: rows, error } = await supabase
    .from('contact_activities')
    .select('id, contact_email, listing_id, remarketing_buyer_id, contact_id')
    .eq('source_system', 'phoneburner')
    .is('contact_id', null)
    .not('contact_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(maxRows);

  if (error) {
    console.error('[rematch-unmatched-activities] PB load error:', error.message);
    summary.errors++;
    return summary;
  }

  type ActivityRow = {
    id: string;
    contact_email: string | null;
    listing_id: string | null;
    remarketing_buyer_id: string | null;
    contact_id: string | null;
  };
  const activities = (rows || []) as ActivityRow[];
  summary.scanned = activities.length;
  if (activities.length === 0) return summary;

  // Batch-load candidate contacts by the set of distinct emails
  const emailSet = new Set<string>();
  for (const a of activities) {
    const e = normalizeEmail(a.contact_email);
    if (e) emailSet.add(e);
  }
  if (emailSet.size === 0) return summary;

  const { data: contactRows, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, email, contact_type, remarketing_buyer_id, listing_id, archived')
    .in('email', Array.from(emailSet))
    .eq('archived', false);

  if (contactsErr) {
    console.error('[rematch-unmatched-activities] contacts load error:', contactsErr.message);
    summary.errors++;
    return summary;
  }

  type ContactRow = {
    id: string;
    email: string;
    contact_type: string;
    remarketing_buyer_id: string | null;
    listing_id: string | null;
  };

  // Bucket candidates by email (lowercased). Prefer buyer > seller > advisor > internal
  const priority: Record<string, number> = { buyer: 0, seller: 1, advisor: 2, internal: 3 };
  const byEmail = new Map<string, ContactRow>();
  for (const c of (contactRows || []) as ContactRow[]) {
    const key = c.email.trim().toLowerCase();
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, c);
      continue;
    }
    const a = priority[c.contact_type] ?? 99;
    const b = priority[existing.contact_type] ?? 99;
    if (a < b) byEmail.set(key, c);
  }

  // Assign matches. Only advance listing_id / remarketing_buyer_id if they're
  // currently NULL on the activity AND the contact carries them — we don't
  // want to rewrite a listing_id the webhook had already resolved.
  for (const a of activities) {
    const e = normalizeEmail(a.contact_email);
    if (!e) continue;
    const contact = byEmail.get(e);
    if (!contact) continue;
    summary.matched++;

    if (dryRun) continue;

    const patch: Record<string, unknown> = { contact_id: contact.id };
    if (!a.remarketing_buyer_id && contact.remarketing_buyer_id) {
      patch.remarketing_buyer_id = contact.remarketing_buyer_id;
    }
    if (!a.listing_id && contact.listing_id) {
      patch.listing_id = contact.listing_id;
    }

    const { error: updErr } = await supabase
      .from('contact_activities')
      .update(patch)
      .eq('id', a.id);

    if (updErr) {
      console.error('[rematch-unmatched-activities] PB update error:', updErr.message);
      summary.errors++;
    } else {
      summary.updated++;
    }
  }

  return summary;
}

// -----------------------------------------------------------------------------
// Smartlead / HeyReach rematch — delegate to promote_unmatched_outreach_for_contact.
// -----------------------------------------------------------------------------
// Approach: collect all distinct lead_email + lead_linkedin_url values from
// the unmatched queue, find contacts with matching email/linkedin (that have
// the required anchor), and call the promotion function for each. The function
// itself handles the insert + queue update atomically.
async function rematchOutreach(
  supabase: SupabaseClient,
  channel: 'smartlead' | 'heyreach',
  maxRows: number,
  dryRun: boolean,
): Promise<RematchSummary> {
  const summary: RematchSummary = {
    channel,
    scanned: 0,
    matched: 0,
    updated: 0,
    errors: 0,
  };

  const table =
    channel === 'smartlead' ? 'smartlead_unmatched_messages' : 'heyreach_unmatched_messages';
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, lead_email, lead_linkedin_url')
    .is('matched_at', null)
    .order('created_at', { ascending: false })
    .limit(maxRows);

  if (error) {
    console.error(`[rematch-unmatched-activities] ${channel} load error:`, error.message);
    summary.errors++;
    return summary;
  }

  type UnmatchedRow = {
    id: string;
    lead_email: string | null;
    lead_linkedin_url: string | null;
  };
  const unmatched = (rows || []) as UnmatchedRow[];
  summary.scanned = unmatched.length;
  if (unmatched.length === 0) return summary;

  // Collect distinct identifiers to look up in contacts
  const emailSet = new Set<string>();
  const urlSet = new Set<string>();
  for (const r of unmatched) {
    const e = normalizeEmail(r.lead_email);
    if (e) emailSet.add(e);
    if (r.lead_linkedin_url) urlSet.add(r.lead_linkedin_url.trim().toLowerCase());
  }

  // Collect candidate contact IDs via both email and linkedin_url queries.
  const contactIds = new Set<string>();

  if (emailSet.size > 0) {
    const { data: byEmail } = await supabase
      .from('contacts')
      .select('id')
      .in('email', Array.from(emailSet))
      .eq('archived', false)
      .not('contact_type', 'in', '("advisor","internal")');
    for (const r of (byEmail || []) as { id: string }[]) contactIds.add(r.id);
  }

  // For LinkedIn, we can't do exact normalized matching in a single IN query
  // (normalization drops protocols/www/trailing-slashes). The SQL function
  // handles normalization server-side, so we just fetch all contacts that have
  // any linkedin_url, filter in JS, and hand off IDs to the promotion function.
  if (urlSet.size > 0) {
    const { data: linkedinContacts } = await supabase
      .from('contacts')
      .select('id, linkedin_url')
      .not('linkedin_url', 'is', null)
      .eq('archived', false)
      .not('contact_type', 'in', '("advisor","internal")')
      .limit(5000);

    const normalizedUrls = new Set<string>();
    for (const u of urlSet) normalizedUrls.add(normalizeLinkedInUrlJs(u) || u);

    for (const c of (linkedinContacts || []) as { id: string; linkedin_url: string | null }[]) {
      const norm = normalizeLinkedInUrlJs(c.linkedin_url);
      if (norm && normalizedUrls.has(norm)) contactIds.add(c.id);
    }
  }

  summary.matched = contactIds.size;
  if (dryRun) return summary;

  for (const cid of contactIds) {
    const { error: rpcErr } = await supabase.rpc('promote_unmatched_outreach_for_contact', {
      p_contact_id: cid,
    });
    if (rpcErr) {
      console.error(`[rematch-unmatched-activities] ${channel} promote error:`, rpcErr.message);
      summary.errors++;
    } else {
      summary.updated++;
    }
  }

  return summary;
}

// Local copy of the shared LinkedIn URL normalizer — kept colocated so this
// function is self-contained if the shared module's shape ever drifts.
function normalizeLinkedInUrlJs(url: string | null | undefined): string | null {
  if (!url) return null;
  let cleaned = url.trim().toLowerCase();
  if (cleaned.length === 0) return null;
  const qIdx = cleaned.indexOf('?');
  if (qIdx >= 0) cleaned = cleaned.slice(0, qIdx);
  const hIdx = cleaned.indexOf('#');
  if (hIdx >= 0) cleaned = cleaned.slice(0, hIdx);
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned.length > 0 ? cleaned : null;
}
