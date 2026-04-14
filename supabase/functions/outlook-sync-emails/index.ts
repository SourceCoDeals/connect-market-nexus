/**
 * outlook-sync-emails: Syncs emails from Microsoft Graph to the platform.
 *
 * Modes:
 *   1. Initial sync (isInitialSync=true): Pull `initialLookbackDays` of
 *      email history (default 365 days). Callers can override
 *      `initialLookbackDays` up to 3650 (≈10 years) for deeper historical
 *      backfills triggered from the Outlook settings page.
 *   2. Polling sync: Fetch recent emails since last sync (fallback for webhooks).
 *
 * Emails whose participants match a known contact are written to
 * `email_messages` and linked to the appropriate deal. Emails whose
 * participants do NOT match any known contact are persisted to
 * `outlook_unmatched_emails` so they can be retro-linked when a matching
 * contact is added later.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response-helpers.ts';
import { requireServiceRole } from '../_shared/auth.ts';

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { address: string; name: string } };
  toRecipients: { emailAddress: { address: string; name: string } }[];
  ccRecipients: { emailAddress: { address: string; name: string } }[];
  sentDateTime: string;
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments?: { name: string; size: number; contentType: string }[];
}

interface ContactMatch {
  id: string;
  email: string;
  /** deal_pipeline.id — the CRM deal this contact is attached to, if any. */
  deal_id?: string | null;
  /** listings.id — seller-contact convenience link (kept for downstream UI). */
  listing_id?: string | null;
}

const DEFAULT_INITIAL_LOOKBACK_DAYS = 365;
const MAX_INITIAL_LOOKBACK_DAYS = 3650; // ~10 years
// Graph page size was raised from 50 → 100 (the practical max for
// /me/messages) so each Graph round-trip fetches twice as many messages per
// invocation. Combined with the page-batched DB writes below that's the
// largest single win for the historical backfill throughput — every page
// fetched halves the number of DB checkpoint writes, Graph round-trips, and
// per-page overhead in the sync loop.
const GRAPH_PAGE_SIZE = 100;
const MAX_INITIAL_PAGES = 400; // 100 messages/page → up to 40k emails per backfill
// Concurrency cap for attachment metadata fetches against Microsoft Graph.
// Graph throttles at the mailbox level; 8 in-flight requests is well under
// the documented per-app-per-mailbox budget while still being enough to
// saturate the latency of a single page's attachments.
const ATTACHMENT_FETCH_CONCURRENCY = 8;
// Module-level cache for the known-contact email map. Deno Deploy keeps
// warm isolates around across invocations, so a short TTL lets resume calls
// skip the ~3-query contact/deal warmup that dominates the first few seconds
// of every `outlook-sync-emails` invocation. Safe because:
//   1. `loadKnownContactEmails` always reads the latest snapshot — no writes.
//   2. The 60-second TTL bounds staleness; rematch-on-contact-insert is
//      handled separately by `rematch_unmatched_outlook_emails`, so a new
//      contact added during a backfill just ends up in the unmatched queue
//      until the next cache refresh, at which point retro-linking catches it.
const CONTACT_CACHE_TTL_MS = 60_000;
let _contactCache: { map: Map<string, ContactMatch>; loadedAt: number } | null = null;

import { decryptToken, encryptToken, refreshAccessToken } from '../_shared/microsoft-tokens.ts';

async function fetchMessages(
  accessToken: string,
  since?: string,
  nextLink?: string,
  retryCount = 0,
): Promise<{ messages: GraphMessage[]; nextLink?: string }> {
  const MAX_RETRIES = 3;
  let url = nextLink;

  if (!url) {
    const params = new URLSearchParams({
      $top: String(GRAPH_PAGE_SIZE),
      $orderby: 'sentDateTime desc',
      $select:
        'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,hasAttachments',
    });

    if (since) {
      params.set('$filter', `sentDateTime ge ${since}`);
    }

    url = `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`Graph API rate limited after ${MAX_RETRIES} retries`);
    }
    // Exponential backoff with jitter
    const retryAfter = parseInt(resp.headers.get('Retry-After') || '5', 10);
    const jitter = Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + jitter));
    return fetchMessages(accessToken, since, nextLink, retryCount + 1);
  }

  if (!resp.ok) {
    throw new Error(`Graph messages fetch failed: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    messages: data.value || [],
    nextLink: data['@odata.nextLink'],
  };
}

async function fetchAttachmentMetadata(
  accessToken: string,
  messageId: string,
): Promise<{ name: string; size: number; contentType: string }[]> {
  try {
    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=name,size,contentType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.value || []).map((a: { name: string; size: number; contentType: string }) => ({
      name: a.name,
      size: a.size,
      contentType: a.contentType,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch attachment metadata for a whole page of messages in parallel.
 *
 * Previously the sync loop awaited one `fetchAttachmentMetadata` call per
 * message with attachments, serializing ~N*100ms of round-trips per page and
 * becoming the single largest source of wall-clock time in the backfill.
 * This batches the fetches with a fixed concurrency cap so we still saturate
 * latency but never blow past Microsoft Graph's per-mailbox throttle.
 *
 * Returns a Map keyed by `message.id` so the page loop can look up each
 * message's attachment list in O(1) without awaiting anything.
 */
async function fetchAttachmentMetadataBatch(
  accessToken: string,
  messageIds: string[],
  concurrency = ATTACHMENT_FETCH_CONCURRENCY,
): Promise<Map<string, { name: string; size: number; contentType: string }[]>> {
  const result = new Map<string, { name: string; size: number; contentType: string }[]>();
  if (messageIds.length === 0) return result;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, messageIds.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= messageIds.length) return;
      const id = messageIds[i];
      const meta = await fetchAttachmentMetadata(accessToken, id);
      result.set(id, meta);
    }
  });
  await Promise.all(workers);
  return result;
}

/**
 * Module-level cached wrapper around {@link loadKnownContactEmails}.
 *
 * The raw loader does 3+ DB queries (contacts scan + two chunked
 * `deal_pipeline` lookups). On a historical backfill that spans many resume
 * invocations, this warmup dominates the first ~2-5s of every call. By
 * caching the resolved map in an isolate-local variable with a short TTL we
 * can reuse it across warm-isolate invocations without ever serving stale
 * data for more than `CONTACT_CACHE_TTL_MS`. Callers should not mutate the
 * returned map.
 */
async function getKnownContactEmails(supabase: SupabaseClient): Promise<Map<string, ContactMatch>> {
  const now = Date.now();
  if (_contactCache && now - _contactCache.loadedAt < CONTACT_CACHE_TTL_MS) {
    return _contactCache.map;
  }
  const fresh = await loadKnownContactEmails(supabase);
  _contactCache = { map: fresh, loadedAt: now };
  return fresh;
}

async function loadKnownContactEmails(
  supabase: SupabaseClient,
): Promise<Map<string, ContactMatch>> {
  const emailMap = new Map<string, ContactMatch>();

  // Load from unified contacts table (include listing_id for deal resolution)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, listing_id')
    .not('email', 'is', null)
    .eq('archived', false);

  if (contacts) {
    for (const c of contacts) {
      if (c.email) {
        emailMap.set(c.email.toLowerCase(), {
          id: c.id,
          email: c.email,
          listing_id: c.listing_id || null,
          deal_id: null,
        });
      }
    }
  }

  // Batch-resolve listing_id → deal_pipeline.id for remarketing deals
  const listingIds = [
    ...new Set([...emailMap.values()].map((c) => c.listing_id).filter(Boolean)),
  ] as string[];
  if (listingIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < listingIds.length; i += chunkSize) {
      const chunk = listingIds.slice(i, i + chunkSize);
      const { data: pipelineDeals } = await supabase
        .from('deal_pipeline')
        .select('id, listing_id')
        .in('listing_id', chunk)
        .is('deleted_at', null);
      const listingDealMap = new Map<string, string>();
      for (const d of pipelineDeals || []) {
        if (d.listing_id) listingDealMap.set(d.listing_id, d.id);
      }
      for (const [, match] of emailMap) {
        if (match.listing_id && !match.deal_id) {
          match.deal_id = listingDealMap.get(match.listing_id) || null;
        }
      }
    }
  }

  // Look up deal associations for contacts via buyer_contact_id / seller_contact_id
  // on `deal_pipeline` (renamed from `deals` in 20260506000000). We exclude
  // soft-deleted deals via `deleted_at IS NULL` — `deal_pipeline` has no
  // `stage` text column; stage is an FK to `deal_stages`, so the previous
  // `.not('stage', 'in', '(...)')` filter was also broken.
  const contactById = new Map<string, ContactMatch>();
  for (const c of emailMap.values()) contactById.set(c.id, c);

  const contactIds = Array.from(contactById.keys());
  if (contactIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < contactIds.length; i += chunkSize) {
      const chunk = contactIds.slice(i, i + chunkSize);

      const { data: buyerDeals, error: buyerErr } = await supabase
        .from('deal_pipeline')
        .select('id, buyer_contact_id, updated_at')
        .in('buyer_contact_id', chunk)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (buyerErr) {
        console.error('[outlook-sync] deal_pipeline buyer lookup failed:', buyerErr.message);
      } else {
        for (const d of buyerDeals || []) {
          if (!d.buyer_contact_id) continue;
          const contact = contactById.get(d.buyer_contact_id);
          // First match wins (we sorted by updated_at desc → most recent deal).
          if (contact && !contact.deal_id) contact.deal_id = d.id;
        }
      }

      const { data: sellerDeals, error: sellerErr } = await supabase
        .from('deal_pipeline')
        .select('id, seller_contact_id, updated_at')
        .in('seller_contact_id', chunk)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (sellerErr) {
        console.error('[outlook-sync] deal_pipeline seller lookup failed:', sellerErr.message);
      } else {
        for (const d of sellerDeals || []) {
          if (!d.seller_contact_id) continue;
          const contact = contactById.get(d.seller_contact_id);
          if (contact && !contact.deal_id) contact.deal_id = d.id;
        }
      }
    }
  }

  return emailMap;
}

function matchEmailToContacts(
  message: GraphMessage,
  contactEmails: Map<string, ContactMatch>,
  userEmail: string,
): { contacts: ContactMatch[]; direction: 'inbound' | 'outbound' } {
  const fromAddress = message.from?.emailAddress?.address?.toLowerCase() || '';
  const toAddresses = (message.toRecipients || []).map((r) =>
    r.emailAddress?.address?.toLowerCase(),
  );
  const ccAddresses = (message.ccRecipients || []).map((r) =>
    r.emailAddress?.address?.toLowerCase(),
  );

  const allAddresses = [fromAddress, ...toAddresses, ...ccAddresses];
  const isOutbound = fromAddress === userEmail.toLowerCase();

  const matchedContacts: ContactMatch[] = [];
  for (const addr of allAddresses) {
    if (addr && addr !== userEmail.toLowerCase()) {
      const match = contactEmails.get(addr);
      if (match) matchedContacts.push(match);
    }
  }

  return {
    contacts: matchedContacts,
    direction: isOutbound ? 'outbound' : 'inbound',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  let body: {
    userId?: string;
    accessToken?: string;
    isInitialSync?: boolean;
    /** How many days back to pull on an initial sync. Default 365. Max 3650. */
    initialLookbackDays?: number;
    /**
     * Microsoft Graph `@odata.nextLink` to resume from. When set, the sync
     * engine skips straight to this cursor instead of starting over at the
     * top of the inbox — this is what makes a frozen backfill picking up
     * from the last checkpoint possible instead of re-fetching every page.
     */
    resumeFromNextLink?: string;
    /**
     * ISO timestamp the caller originally started the backfill against.
     * Persisted as `email_connections.backfill_since` so the cutoff window
     * never drifts forward when a long backfill is resumed across multiple
     * invocations.
     */
    backfillSince?: string;
    /**
     * When true, `syncEmails` writes progress checkpoints to
     * `email_connections` after every page. Enabled for historical backfills
     * (initial/deep) — skipped for incremental polling syncs, where the
     * extra row update isn't worth the cost.
     */
    trackBackfillProgress?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid request body', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // If called from polling (no accessToken provided), process all active connections
  if (!body.userId && !body.accessToken) {
    // Polling mode is only for service role (pg_cron scheduler or internal webhook trigger)
    const authCheck = requireServiceRole(req);
    if (!authCheck.authorized) {
      return errorResponse(authCheck.error || 'Unauthorized', 403, corsHeaders);
    }

    // Only poll connections that have completed initial sync
    const { data: connections } = await supabase
      .from('email_connections')
      .select('*')
      .eq('status', 'active')
      .eq('initial_sync_complete', true);

    if (!connections || connections.length === 0) {
      return successResponse({ message: 'No active connections to sync' }, corsHeaders);
    }

    const results: { userId: string; synced: number; errors: string[] }[] = [];

    for (const conn of connections) {
      try {
        const refreshToken = await decryptToken(conn.encrypted_refresh_token);
        const tokenResult = await refreshAccessToken(refreshToken);

        if (!tokenResult) {
          // Track consecutive failures
          const newErrorCount = (conn.last_sync_error_count || 0) + 1;
          const updates: Record<string, unknown> = {
            last_sync_error_count: newErrorCount,
            error_message: 'Token refresh failed during polling sync',
          };

          if (newErrorCount >= 3) {
            updates.status = 'error';
            updates.error_message = 'Token refresh failed 3 consecutive times';
          }

          await supabase.from('email_connections').update(updates).eq('id', conn.id);

          results.push({
            userId: conn.sourceco_user_id,
            synced: 0,
            errors: ['Token refresh failed'],
          });
          continue;
        }

        // Update stored refresh token if it changed
        if (tokenResult.newRefreshToken !== refreshToken) {
          await supabase
            .from('email_connections')
            .update({
              encrypted_refresh_token: await encryptToken(tokenResult.newRefreshToken),
              token_expires_at: new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString(),
            })
            .eq('id', conn.id);
        }

        // Sync since last sync
        const since = conn.last_sync_at || new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const syncResult = await syncEmails(
          supabase,
          tokenResult.accessToken,
          conn.sourceco_user_id,
          conn.email_address,
          since,
          false,
        );

        await supabase
          .from('email_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_error_count: 0,
            error_message: null,
          })
          .eq('id', conn.id);

        results.push({
          userId: conn.sourceco_user_id,
          synced: syncResult.synced,
          errors: syncResult.errors,
        });
      } catch (err) {
        console.error(`Sync failed for user ${conn.sourceco_user_id}:`, err);
        results.push({
          userId: conn.sourceco_user_id,
          synced: 0,
          errors: [(err as Error).message],
        });
      }
    }

    return successResponse({ results }, corsHeaders);
  }

  // Single user sync (called from callback or webhook trigger, both use service role key)
  const authCheck = requireServiceRole(req);
  if (!authCheck.authorized) {
    return errorResponse(authCheck.error || 'Unauthorized', 403, corsHeaders);
  }

  const userId = body.userId!;
  let accessToken = body.accessToken;

  if (!accessToken) {
    // Need to get an access token from the stored refresh token
    const { data: conn } = await supabase
      .from('email_connections')
      .select('*')
      .eq('sourceco_user_id', userId)
      .eq('status', 'active')
      .single();

    if (!conn) {
      return errorResponse('No active connection found', 404, corsHeaders);
    }

    const refreshToken = await decryptToken(conn.encrypted_refresh_token);
    const tokenResult = await refreshAccessToken(refreshToken);
    if (!tokenResult) {
      return errorResponse('Failed to refresh access token', 500, corsHeaders);
    }
    accessToken = tokenResult.accessToken;
  }

  // Get connection info
  const { data: connection } = await supabase
    .from('email_connections')
    .select('email_address')
    .eq('sourceco_user_id', userId)
    .single();

  if (!connection) {
    return errorResponse('Connection not found', 404, corsHeaders);
  }

  const requestedLookback = Math.max(
    1,
    Math.min(body.initialLookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS, MAX_INITIAL_LOOKBACK_DAYS),
  );
  // Prefer the caller-provided `backfillSince` (carried forward across
  // resumes) over a fresh `Date.now() - lookback` computation so the cutoff
  // window is stable across checkpoint restarts.
  const since = body.isInitialSync
    ? body.backfillSince ||
      new Date(Date.now() - requestedLookback * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const result = await syncEmails(
    supabase,
    accessToken,
    userId,
    connection.email_address,
    since,
    body.isInitialSync || false,
    {
      resumeFromNextLink: body.resumeFromNextLink,
      trackBackfillProgress: body.trackBackfillProgress === true,
    },
  );

  // Update last sync timestamp (and mark initial sync complete if applicable)
  const syncUpdate: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    last_sync_error_count: 0,
    error_message: null,
  };
  if (body.isInitialSync) {
    syncUpdate.initial_sync_complete = true;
  }

  await supabase.from('email_connections').update(syncUpdate).eq('sourceco_user_id', userId);

  return successResponse(result, corsHeaders);
});

interface SyncEmailsOptions {
  /**
   * Microsoft Graph `@odata.nextLink` cursor to resume from. When set, the
   * sync engine skips straight to this URL instead of walking the inbox from
   * the newest page — this is what lets a crashed backfill pick up at its
   * last checkpoint.
   */
  resumeFromNextLink?: string;
  /**
   * When true, write per-page checkpoints to
   * `email_connections.backfill_*` so the Outlook settings page can show a
   * live progress bar and the next resume call can pick up from
   * `backfill_next_link`. Off by default for incremental polling — those
   * don't need per-row progress.
   */
  trackBackfillProgress?: boolean;
}

async function syncEmails(
  supabase: SupabaseClient,
  accessToken: string,
  userId: string,
  userEmail: string,
  since?: string,
  isInitial = false,
  options: SyncEmailsOptions = {},
): Promise<{ synced: number; skipped: number; queuedUnmatched: number; errors: string[] }> {
  const contactEmails = await getKnownContactEmails(supabase);
  let synced = 0;
  let skipped = 0;
  let queuedUnmatched = 0;
  const errors: string[] = [];
  let nextLink: string | undefined = options.resumeFromNextLink;
  let pageCount = 0;
  const maxPages = isInitial ? MAX_INITIAL_PAGES : 10; // Deep backfill for initial, bounded for polling

  // Tracks the oldest sentDateTime we've processed in this run — drives the
  // progress-bar percentage in the Outlook settings UI via
  // `(started_at - earliest_seen_at) / (started_at - since)`.
  let earliestSeenAt: string | null = null;

  /**
   * Write a per-page checkpoint to `email_connections.backfill_*`. Called at
   * the bottom of each successful page so a crash/timeout leaves a recoverable
   * cursor behind. No-op when `trackBackfillProgress` is false.
   *
   * We write AFTER the upserts for the page have completed (not before), so
   * `backfill_next_link` always points at the next page to fetch — never at
   * a page whose messages haven't been persisted yet.
   */
  const writeCheckpoint = async (cursorNextLink: string | undefined) => {
    if (!options.trackBackfillProgress) return;
    try {
      const update: Record<string, unknown> = {
        backfill_next_link: cursorNextLink ?? null,
        backfill_pages_processed: pageCount,
        backfill_messages_synced: synced,
        backfill_messages_skipped: skipped,
        backfill_messages_queued: queuedUnmatched,
        backfill_heartbeat_at: new Date().toISOString(),
      };
      if (earliestSeenAt) update.backfill_earliest_seen_at = earliestSeenAt;
      await supabase.from('email_connections').update(update).eq('sourceco_user_id', userId);
    } catch (e) {
      // Checkpoint failures must never abort the sync — the worst case is the
      // UI shows stale progress, but the idempotent upserts still make forward
      // progress.
      console.error('[outlook-sync] checkpoint write failed (non-fatal):', e);
    }
  };

  do {
    try {
      const result = await fetchMessages(accessToken, since, nextLink);
      nextLink = result.nextLink;

      // Update the earliest-seen watermark for progress calculation. Pages
      // come back newest-first (`$orderby: sentDateTime desc`), so the
      // LAST message in the array is the oldest on this page.
      if (result.messages.length > 0) {
        const lastOnPage = result.messages[result.messages.length - 1];
        const oldestTs = lastOnPage.sentDateTime || lastOnPage.receivedDateTime;
        if (oldestTs && (!earliestSeenAt || oldestTs < earliestSeenAt)) {
          earliestSeenAt = oldestTs;
        }
      }

      // ── Page-level batch processing ─────────────────────────────────────
      //
      // Everything below used to run per-message with `await` round-trips for
      // the platform_sent lookup, attachment fetch, unmatched upsert, matched
      // upsert, and deal-activity RPC — that's ~150+ sequential blocking
      // calls per 50-message page, which is what made the historical backfill
      // run at <3 messages/second. The rewrite collects every message's work
      // into a few bulk ops per page instead:
      //
      //   1. One Graph-page-wide query for any `platform_sent_*` placeholder
      //      rows that need to be upgraded with real Graph IDs. Matches are
      //      resolved in-memory against `(from_address, sent_at ±60s)`.
      //   2. One parallel fan-out of attachment-metadata fetches (concurrency
      //      capped at ATTACHMENT_FETCH_CONCURRENCY).
      //   3. One `upsert` into `outlook_unmatched_emails` for all unmatched
      //      messages on the page.
      //   4. One `upsert` into `email_messages` for all matched rows on the
      //      page (flattened across contacts when a message matches several).
      //   5. `deal_activities` logging is now handled by an AFTER INSERT
      //      trigger on `email_messages` (migration 20260718000000) instead
      //      of a per-row RPC call, so the sync loop doesn't pay for it at
      //      all.
      //
      // Counters (`synced` / `skipped` / `queuedUnmatched`) are derived from
      // the bulk upsert return value lengths so the progress row stays
      // accurate even when `ignoreDuplicates` silently drops conflicting
      // rows.
      try {
        const pageMessages = result.messages;

        // Track message IDs we've already accounted for in an earlier step
        // (e.g. platform_sent claim, zero-participant skip) so they don't
        // fall through to the matched/unmatched pipelines.
        const consumedMessageIds = new Set<string>();

        // ── 1. Platform-sent placeholder upgrade (batched) ────────────────
        //
        // Any outbound message on this page might correspond to an email the
        // user previously sent via the platform's own send-email function —
        // those live in `email_messages` under a `platform_sent_<uuid>`
        // placeholder id and need to be upgraded in place with the real
        // Graph id instead of creating a second row.
        const outboundCandidates = pageMessages.filter(
          (m) => m.from?.emailAddress?.address?.toLowerCase() === userEmail.toLowerCase(),
        );

        if (outboundCandidates.length > 0) {
          // Compute the tightest sent_at window that covers every outbound
          // message on this page (±60s tolerance for clock skew). One DB
          // query for the whole page replaces up to N per-message calls.
          let windowMin = Infinity;
          let windowMax = -Infinity;
          for (const m of outboundCandidates) {
            const ts = new Date(m.sentDateTime || m.receivedDateTime).getTime();
            if (Number.isFinite(ts)) {
              if (ts < windowMin) windowMin = ts;
              if (ts > windowMax) windowMax = ts;
            }
          }

          if (Number.isFinite(windowMin) && Number.isFinite(windowMax)) {
            const windowStart = new Date(windowMin - 60_000).toISOString();
            const windowEnd = new Date(windowMax + 60_000).toISOString();

            const { data: platformSentRows, error: platformSentErr } = await supabase
              .from('email_messages')
              .select('id, microsoft_message_id, from_address, sent_at')
              .like('microsoft_message_id', 'platform_sent_%')
              .eq('sourceco_user_id', userId)
              .gte('sent_at', windowStart)
              .lte('sent_at', windowEnd);

            if (platformSentErr) {
              errors.push(`Platform-sent lookup failed: ${platformSentErr.message}`);
            } else if (platformSentRows && platformSentRows.length > 0) {
              // Match each outbound candidate to at most one platform_sent
              // row (±60s around the reported sentDateTime). We mark
              // claimed rows so the same placeholder can't be matched to
              // two different Graph messages within one page.
              const usedPlatformIds = new Set<string>();
              const upgrades: { placeholderId: string; realId: string; conversationId: string }[] =
                [];
              for (const m of outboundCandidates) {
                const fromAddr = m.from?.emailAddress?.address?.toLowerCase() || '';
                const msgTs = new Date(m.sentDateTime || m.receivedDateTime).getTime();
                if (!Number.isFinite(msgTs)) continue;
                const match = platformSentRows.find((row) => {
                  if (usedPlatformIds.has(row.id)) return false;
                  if ((row.from_address || '').toLowerCase() !== fromAddr) return false;
                  const rowTs = new Date(row.sent_at).getTime();
                  return Math.abs(rowTs - msgTs) <= 60_000;
                });
                if (match) {
                  usedPlatformIds.add(match.id);
                  upgrades.push({
                    placeholderId: match.id,
                    realId: m.id,
                    conversationId: m.conversationId,
                  });
                  consumedMessageIds.add(m.id);
                }
              }

              if (upgrades.length > 0) {
                // Upgrades target different PKs with different values, so we
                // still need one UPDATE per row — but we fire them in
                // parallel instead of awaiting sequentially. In practice a
                // page has 0-2 of these so the cost is negligible compared
                // to the old per-every-outbound-message behavior.
                const upgradeResults = await Promise.all(
                  upgrades.map((u) =>
                    supabase
                      .from('email_messages')
                      .update({
                        microsoft_message_id: u.realId,
                        microsoft_conversation_id: u.conversationId,
                      })
                      .eq('id', u.placeholderId),
                  ),
                );
                for (let i = 0; i < upgradeResults.length; i++) {
                  const r = upgradeResults[i];
                  if (r.error) {
                    errors.push(
                      `Platform-sent upgrade failed for ${upgrades[i].realId}: ${r.error.message}`,
                    );
                  } else {
                    skipped++;
                  }
                }
              }
            }
          }
        }

        // ── 2. Attachment metadata (parallel fan-out) ─────────────────────
        //
        // Collect every non-consumed message with `hasAttachments` and
        // fetch their metadata in parallel. `fetchAttachmentMetadataBatch`
        // handles the concurrency cap so Microsoft Graph isn't swamped.
        const attachmentTargets = pageMessages
          .filter((m) => m.hasAttachments && !consumedMessageIds.has(m.id))
          .map((m) => m.id);
        const attachmentMap = await fetchAttachmentMetadataBatch(accessToken, attachmentTargets);

        // ── 3/4. Matched + unmatched row accumulation ─────────────────────
        //
        // Walk every remaining message once, classify it, and push the
        // resulting row(s) into the right batch. Nothing awaits inside this
        // loop — all the I/O happens above (already done) or below (bulk
        // upserts).
        const unmatchedRows: Record<string, unknown>[] = [];
        const matchedRows: Record<string, unknown>[] = [];

        for (const msg of pageMessages) {
          if (consumedMessageIds.has(msg.id)) continue;
          try {
            const match = matchEmailToContacts(msg, contactEmails, userEmail);
            const attachmentMeta = msg.hasAttachments ? attachmentMap.get(msg.id) || [] : [];

            if (match.contacts.length === 0) {
              const fromAddr = msg.from?.emailAddress?.address?.toLowerCase() || '';
              const toAddrs = (msg.toRecipients || [])
                .map((r) => r.emailAddress?.address?.toLowerCase())
                .filter(Boolean) as string[];
              const ccAddrs = (msg.ccRecipients || [])
                .map((r) => r.emailAddress?.address?.toLowerCase())
                .filter(Boolean) as string[];

              const participantEmails = Array.from(
                new Set(
                  [fromAddr, ...toAddrs, ...ccAddrs].filter(
                    (addr): addr is string => !!addr && addr !== userEmail.toLowerCase(),
                  ),
                ),
              );

              // If nobody besides the mailbox owner was on the message there
              // is nothing worth queueing — count as skipped and drop it.
              if (participantEmails.length === 0) {
                skipped++;
                continue;
              }

              unmatchedRows.push({
                microsoft_message_id: msg.id,
                microsoft_conversation_id: msg.conversationId,
                sourceco_user_id: userId,
                mailbox_address: userEmail,
                direction: match.direction,
                from_address: msg.from?.emailAddress?.address || '',
                to_addresses: (msg.toRecipients || []).map((r) => r.emailAddress?.address),
                cc_addresses: (msg.ccRecipients || []).map((r) => r.emailAddress?.address),
                participant_emails: participantEmails,
                subject: msg.subject || '(No subject)',
                body_html: msg.body?.contentType === 'html' ? msg.body.content : null,
                body_text: msg.body?.contentType === 'text' ? msg.body.content : null,
                body_preview: msg.bodyPreview || null,
                sent_at: msg.sentDateTime || msg.receivedDateTime,
                has_attachments: msg.hasAttachments || false,
                attachment_metadata: attachmentMeta,
              });
              continue;
            }

            for (const contact of match.contacts) {
              matchedRows.push({
                microsoft_message_id: msg.id,
                microsoft_conversation_id: msg.conversationId,
                contact_id: contact.id,
                deal_id: contact.deal_id || null,
                sourceco_user_id: userId,
                direction: match.direction,
                from_address: msg.from?.emailAddress?.address || '',
                to_addresses: (msg.toRecipients || []).map((r) => r.emailAddress?.address),
                cc_addresses: (msg.ccRecipients || []).map((r) => r.emailAddress?.address),
                subject: msg.subject || '(No subject)',
                body_html: msg.body?.contentType === 'html' ? msg.body.content : null,
                body_text: msg.body?.contentType === 'text' ? msg.body.content : msg.bodyPreview,
                sent_at: msg.sentDateTime || msg.receivedDateTime,
                has_attachments: msg.hasAttachments || false,
                attachment_metadata: attachmentMeta,
                bcc_addresses: [],
              });
            }
          } catch (err) {
            errors.push(`Message ${msg.id}: ${(err as Error).message}`);
          }
        }

        // ── 5. Bulk upserts (one call each, in parallel) ──────────────────
        //
        // Run the two bulk upserts concurrently — they hit disjoint tables
        // and neither depends on the other's result. `.select('id')` forces
        // PostgREST to return only the rows that were actually inserted
        // (ignoreDuplicates = `ON CONFLICT DO NOTHING`), so we can derive
        // exact synced/skipped counts without round-tripping per row.
        const unmatchedTask =
          unmatchedRows.length > 0
            ? (async () => {
                const { data, error } = await supabase
                  .from('outlook_unmatched_emails')
                  .upsert(unmatchedRows, {
                    onConflict: 'microsoft_message_id,sourceco_user_id',
                    ignoreDuplicates: true,
                  })
                  .select('id');
                if (error) {
                  errors.push(`Bulk unmatched upsert failed: ${error.message}`);
                  return;
                }
                const inserted = data?.length ?? 0;
                queuedUnmatched += inserted;
                skipped += unmatchedRows.length - inserted;
              })()
            : Promise.resolve();

        const matchedTask =
          matchedRows.length > 0
            ? (async () => {
                const { data, error } = await supabase
                  .from('email_messages')
                  .upsert(matchedRows, {
                    onConflict: 'microsoft_message_id,contact_id',
                    ignoreDuplicates: true,
                  })
                  .select('id');
                if (error) {
                  errors.push(`Bulk matched upsert failed: ${error.message}`);
                  return;
                }
                const inserted = data?.length ?? 0;
                synced += inserted;
                skipped += matchedRows.length - inserted;
              })()
            : Promise.resolve();

        await Promise.all([unmatchedTask, matchedTask]);
      } catch (err) {
        // Errors thrown *outside* the inner per-message try/catch (e.g. the
        // Graph page itself failing mid-iteration) bubble up into the outer
        // page-fetch catch below. We only land here for unexpected runtime
        // failures inside the batch pipeline — record them so the operator
        // sees them in the sync result.
        errors.push(`Page batch processing error: ${(err as Error).message}`);
      }

      pageCount++;

      // Per-page checkpoint. After this write, a crash/timeout leaves a
      // resumable state behind: the next invocation of `outlook-backfill-history`
      // can pass `resumeFromNextLink` and skip straight here instead of
      // re-walking the inbox. This is the mechanism that makes "if it freezes
      // we don't have to resync what we already synced" actually true even
      // though the underlying upserts were already idempotent — it saves the
      // wall-clock time of re-fetching every page from Microsoft Graph.
      await writeCheckpoint(nextLink);
    } catch (err) {
      errors.push(`Page fetch error: ${(err as Error).message}`);
      // Flush the checkpoint so the caller knows where we got to even though
      // this run is aborting. `nextLink` still points at the page that just
      // failed, so the resume path re-attempts exactly that page.
      await writeCheckpoint(nextLink);
      break;
    }
  } while (nextLink && pageCount < maxPages);

  console.log(
    `Sync complete: ${synced} synced, ${skipped} skipped, ${queuedUnmatched} queued-unmatched, ${errors.length} errors`,
  );

  // ── Trigger auto-summarize for email threads with 3+ messages ──
  if (synced > 0) {
    try {
      // Find conversation threads with 3+ emails that haven't been summarized yet
      const { data: threadCandidates } = await (supabase as any).rpc(
        'get_unsummarized_email_threads',
        {},
      );
      // Fallback: query directly if RPC doesn't exist
      if (!threadCandidates) {
        const { data: threads } = await (supabase as any)
          .from('email_messages')
          .select('microsoft_conversation_id, deal_id')
          .not('microsoft_conversation_id', 'is', null)
          .not('deal_id', 'is', null);

        if (threads) {
          // Count by conversation_id + deal_id
          const threadCounts = new Map<
            string,
            { count: number; deal_id: string; conversation_id: string }
          >();
          for (const t of threads) {
            const key = `${t.microsoft_conversation_id}::${t.deal_id}`;
            const existing = threadCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              threadCounts.set(key, {
                count: 1,
                deal_id: t.deal_id,
                conversation_id: t.microsoft_conversation_id,
              });
            }
          }

          for (const [, thread] of threadCounts) {
            if (thread.count >= 3) {
              try {
                await supabase.functions.invoke('auto-summarize-email-thread', {
                  body: { conversation_id: thread.conversation_id, deal_id: thread.deal_id },
                });
              } catch (e) {
                console.error(`[outlook-sync] Failed to trigger email thread summary:`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[outlook-sync] Email thread summary check failed:', e);
    }
  }

  return { synced, skipped, queuedUnmatched, errors };
}
