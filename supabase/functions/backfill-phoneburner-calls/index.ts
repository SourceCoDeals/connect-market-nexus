/**
 * backfill-phoneburner-calls
 *
 * One-shot/admin-triggered pull of historical calls from PhoneBurner's REST
 * API into contact_activities. PhoneBurner's webhook is forward-only — any
 * call made before the webhook was wired up (or during an outage) never
 * enters the CRM. This function closes the gap by walking the PB /calls
 * endpoint per connected user and writing missing rows.
 *
 * Endpoint shape assumed (confirm with PhoneBurner docs if the pull returns
 * a 404):  GET /rest/1/calls?page=N&per_page=100&start_date=...&end_date=...
 *   returns: { data: [ { id, start_time, end_time, duration, contact: {...},
 *                        disposition: {...}, recording_url, ... } ] }
 *
 * If PB's endpoint differs, the fetch wrapper surfaces the HTTP status and
 * body so the response body of this function tells the operator what to
 * correct. Nothing is mutated on PB's side.
 *
 * Matching: we reuse phoneburner-webhook's contact-resolution semantics
 * (email first, then phone, with multi-phone fallback) via the shared
 * `resolve_phone_activity_link_by_phone` RPC. Historical calls that can't
 * be matched are still inserted into contact_activities with contact_id =
 * NULL so they surface in the unmatched-activities admin page and the
 * rematch-unmatched-activities edge function can recover them later.
 *
 * Invocation:
 *   POST /functions/v1/backfill-phoneburner-calls
 *   Body (all optional):
 *     { user_id: UUID }           — restrict to one connected PB user
 *     { days_back: number }       — default 90, cap 730
 *     { max_pages: number }       — default 20, cap 200 (100 calls/page)
 *     { dry_run: boolean }        — scan and report without writing
 *
 * Admin-only (via CRON_SECRET / service-role JWT / admin JWT).
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest } from '../_shared/outreach-match.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

const PB_API_BASE = 'https://www.phoneburner.com/rest/1';

interface ReqBody {
  user_id?: string;
  days_back?: number;
  max_pages?: number;
  dry_run?: boolean;
}

interface PbCallRow {
  id?: string | number;
  call_id?: string | number;
  start_time?: string;
  started_at?: string;
  end_time?: string;
  ended_at?: string;
  duration?: number;
  duration_seconds?: number;
  talk_time?: number;
  talk_time_seconds?: number;
  direction?: string;
  contact?: {
    id?: string | number;
    name?: string;
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  contact_email?: string;
  contact_phone?: string;
  contact_name?: string;
  disposition?: {
    code?: string;
    label?: string;
    notes?: string;
  };
  disposition_code?: string;
  disposition_label?: string;
  disposition_notes?: string;
  recording_url?: string;
  recording_url_public?: string;
  user?: { name?: string; email?: string };
  user_name?: string;
  user_email?: string;
  [key: string]: unknown;
}

interface PerUserResult {
  user_id: string;
  pb_user_email: string | null;
  pages_scanned: number;
  calls_fetched: number;
  calls_written: number;
  calls_matched: number;
  calls_unmatched: number;
  calls_already_existed: number;
  errors: number;
  last_error: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!isAuthorizedCronRequest(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let body: ReqBody = {};
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    // defaults
  }

  const daysBack = Math.min(Math.max(body.days_back || 90, 1), 730);
  const maxPages = Math.min(Math.max(body.max_pages || 20, 1), 200);
  const dryRun = body.dry_run === true;

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);

  // Load connected PB users (those with an access_token). Each PB user has
  // their own call history — we must iterate per token.
  let tokenQuery = supabase
    .from('phoneburner_oauth_tokens')
    .select('user_id, access_token, phoneburner_user_email, display_name');

  if (body.user_id) tokenQuery = tokenQuery.eq('user_id', body.user_id);

  const { data: tokens, error: tokensErr } = await tokenQuery;
  if (tokensErr || !tokens?.length) {
    return new Response(
      JSON.stringify({
        error: 'no_connected_users',
        detail: tokensErr?.message ?? 'No phoneburner_oauth_tokens rows',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const startedAt = Date.now();
  const perUser: PerUserResult[] = [];

  for (const token of tokens as Array<{
    user_id: string;
    access_token: string;
    phoneburner_user_email: string | null;
  }>) {
    const result = await backfillOneUser(
      supabase,
      token.user_id,
      token.access_token,
      token.phoneburner_user_email,
      startDate,
      endDate,
      maxPages,
      dryRun,
    );
    perUser.push(result);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run: dryRun,
      days_back: daysBack,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_ms: Date.now() - startedAt,
      per_user: perUser,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

async function backfillOneUser(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  pbUserEmail: string | null,
  startDate: Date,
  endDate: Date,
  maxPages: number,
  dryRun: boolean,
): Promise<PerUserResult> {
  const result: PerUserResult = {
    user_id: userId,
    pb_user_email: pbUserEmail,
    pages_scanned: 0,
    calls_fetched: 0,
    calls_written: 0,
    calls_matched: 0,
    calls_unmatched: 0,
    calls_already_existed: 0,
    errors: 0,
    last_error: null,
  };

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${PB_API_BASE}/calls`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    url.searchParams.set('start_date', startDate.toISOString().slice(0, 10));
    url.searchParams.set('end_date', endDate.toISOString().slice(0, 10));

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      result.errors++;
      result.last_error = `fetch_error:${err instanceof Error ? err.message : String(err)}`;
      break;
    }

    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      result.errors++;
      result.last_error = `http_${resp.status}:${bodyText.slice(0, 200)}`;
      // 401/403 means this token is dead; don't burn more pages on it
      if (resp.status === 401 || resp.status === 403) break;
      // 404 likely means endpoint shape differs — surface so operator adjusts
      if (resp.status === 404) break;
      // other errors: stop trying this user, operator will retry
      break;
    }

    const json = await resp.json();
    // PB's list responses vary: { data: [...] } or { calls: [...] } or raw array
    const calls: PbCallRow[] = Array.isArray(json)
      ? (json as PbCallRow[])
      : Array.isArray(json?.data)
        ? (json.data as PbCallRow[])
        : Array.isArray(json?.calls)
          ? (json.calls as PbCallRow[])
          : [];

    result.pages_scanned++;
    result.calls_fetched += calls.length;
    if (calls.length === 0) break; // no more pages

    for (const call of calls) {
      await ingestCall(supabase, call, userId, pbUserEmail, dryRun, result);
    }

    // Short-circuit when a page returns fewer than a full page
    if (calls.length < 100) break;
  }

  return result;
}

async function ingestCall(
  supabase: SupabaseClient,
  call: PbCallRow,
  userId: string,
  pbUserEmail: string | null,
  dryRun: boolean,
  result: PerUserResult,
): Promise<void> {
  const pbCallId = String(call.id ?? call.call_id ?? '');
  if (!pbCallId) {
    result.errors++;
    return;
  }

  // Idempotency: skip if we already have this call in contact_activities.
  // phoneburner_call_id is indexed, so this is cheap.
  const { data: existing } = await supabase
    .from('contact_activities')
    .select('id')
    .eq('phoneburner_call_id', pbCallId)
    .maybeSingle();

  if (existing) {
    result.calls_already_existed++;
    return;
  }

  const startedAt = call.start_time || call.started_at || null;
  const endedAt = call.end_time || call.ended_at || null;
  const duration = call.duration ?? call.duration_seconds ?? null;
  const talkTime = call.talk_time ?? call.talk_time_seconds ?? null;

  const contactEmail = call.contact?.email || call.contact_email || null;
  const contactPhone = call.contact?.phone || call.contact_phone || null;
  const contactName =
    call.contact?.name ||
    call.contact_name ||
    [call.contact?.first_name, call.contact?.last_name].filter(Boolean).join(' ') ||
    null;

  const dispositionCode = call.disposition?.code || call.disposition_code || null;
  const dispositionLabel = call.disposition?.label || call.disposition_label || null;
  const dispositionNotes = call.disposition?.notes || call.disposition_notes || null;

  // Resolve contact via the existing RPC (email + phone scoring). Returns
  // NULL-ish when nothing matches; we still write the row with contact_id
  // NULL so it surfaces in unmatched-activities.
  let contactId: string | null = null;
  let listingId: string | null = null;
  let buyerId: string | null = null;

  if (contactPhone) {
    const { data: match } = await supabase.rpc('resolve_phone_activity_link_by_phone', {
      p_phone: contactPhone,
      p_name: contactName,
      p_email: contactEmail,
    });
    if (Array.isArray(match) && match.length > 0) {
      const m = match[0] as {
        contact_id: string | null;
        listing_id: string | null;
        remarketing_buyer_id: string | null;
      };
      contactId = m.contact_id;
      listingId = m.listing_id;
      buyerId = m.remarketing_buyer_id;
    }
  }

  if (contactId) result.calls_matched++;
  else result.calls_unmatched++;

  if (dryRun) {
    result.calls_written++; // count as would-be-written
    return;
  }

  const row = {
    phoneburner_call_id: pbCallId,
    phoneburner_event_id: `backfill-${pbCallId}`, // idempotency key distinct from webhook
    activity_type: endedAt ? 'call_completed' : 'call_attempt',
    source_system: 'phoneburner',
    call_started_at: startedAt,
    call_ended_at: endedAt,
    call_duration_seconds: duration,
    talk_time_seconds: talkTime,
    call_direction: call.direction || null,
    call_connected: talkTime !== null && talkTime > 0,
    disposition_code: dispositionCode,
    disposition_label: dispositionLabel,
    disposition_notes: dispositionNotes,
    disposition_set_at: dispositionCode ? endedAt : null,
    recording_url: call.recording_url || null,
    recording_url_public: call.recording_url_public || call.recording_url || null,
    contact_email: contactEmail,
    user_id: userId,
    user_name: call.user?.name || call.user_name || null,
    user_email: call.user?.email || call.user_email || pbUserEmail,
    contact_id: contactId,
    listing_id: listingId,
    remarketing_buyer_id: buyerId,
  };

  const { error: insertErr } = await supabase.from('contact_activities').insert(row);

  if (insertErr) {
    // Unique-violation on phoneburner_call_id or event_id is benign (race).
    if (!insertErr.message.includes('duplicate')) {
      result.errors++;
      result.last_error = insertErr.message;
    } else {
      result.calls_already_existed++;
    }
    return;
  }

  result.calls_written++;
}
