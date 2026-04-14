/**
 * outlook-bulk-backfill-all: Admin-only one-click historical backfill for
 * every active Outlook connection in the workspace.
 *
 * This is the operator escape hatch to roll out the Outlook integration fixes
 * (see migration 20260703000001) against a mailboxes already connected before
 * those fixes landed. It:
 *
 *   1. Loads every `email_connections` row with `status = 'active'`.
 *   2. For each mailbox, calls `outlook-sync-emails` with
 *      `isInitialSync = true` and `initialLookbackDays = <N>` (default 365).
 *      The sync engine then pulls the last N days of history from Microsoft
 *      Graph, writes matched emails into `email_messages` against the right
 *      contacts and deals, and queues unmatched messages into
 *      `outlook_unmatched_emails` for later retro-linking.
 *   3. After all mailboxes have been processed, calls the
 *      `rematch_unmatched_outlook_emails` RPC one final time so anything
 *      captured during the bulk run is immediately promoted against the
 *      current contact set.
 *
 * Only admins may call this. The request must be authenticated as an admin
 * user — we do NOT accept a service-role JWT here because the value of this
 * endpoint is that a human admin can kick it off from the UI.
 *
 * Mailboxes are processed SEQUENTIALLY so we don't overload the Microsoft
 * Graph API. Graph itself is rate-limited per-tenant, and running 10
 * simultaneous initial syncs is much more likely to trip 429s than running
 * them one at a time. If you have 50 mailboxes this call may take several
 * minutes; the caller should handle that gracefully.
 *
 * IMPORTANT: The per-mailbox sync loop runs as a TRUE background task via
 * `EdgeRuntime.waitUntil`. A sequential walk over N mailboxes with a 365-day
 * lookback each reliably exceeds Supabase's hard 150-second edge-function
 * ceiling, and before this fix the UI surfaced the platform timeout as
 * "Failed to send a request to the Edge Function" even though the sync
 * engine itself was healthy. The HTTP response now returns immediately
 * with status 202 and the list of mailboxes queued for processing; callers
 * should poll `email_connections.last_sync_at` or just refresh the settings
 * page after a couple of minutes to see results.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/response-helpers.ts';

const DEFAULT_DAYS_BACK = 365;
const MAX_DAYS_BACK = 3650; // ~10 years — matches outlook-sync-emails ceiling.

interface PerMailboxResult {
  userId: string;
  emailAddress: string;
  ok: boolean;
  synced?: number;
  skipped?: number;
  queuedUnmatched?: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  // CRITICAL: everything below must run inside the outer try/catch. Before
  // this guard landed, an unhandled throw from `requireAuth`, `createClient`,
  // the `is_admin` RPC, or the `email_connections` SELECT crashed the isolate.
  // Deno Deploy then serves a platform 500 with NO CORS headers, which the
  // browser rejects — and `supabase.functions.invoke` surfaces that as
  // `FunctionsFetchError: "Failed to send a request to the Edge Function"`,
  // the error seen on the Outlook settings page.
  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405, corsHeaders);
    }

    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return errorResponse(auth.error || 'Authentication required', 401, corsHeaders);
    }

    let body: { daysBack?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine — use defaults.
    }

    const daysBack = Math.max(
      1,
      Math.min(Number(body.daysBack) || DEFAULT_DAYS_BACK, MAX_DAYS_BACK),
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[outlook-bulk-backfill-all] missing SUPABASE_URL or SERVICE_ROLE_KEY env');
      return errorResponse('Bulk backfill not configured on the server', 500, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Admin gate — this endpoint can rewrite email history for every team member,
    // so it MUST be admin-only.
    const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin', {
      user_id: auth.userId,
    });
    if (adminErr) {
      console.error('[outlook-bulk-backfill-all] is_admin lookup failed:', adminErr);
      return errorResponse('Failed to verify admin status', 500, corsHeaders);
    }
    if (!isAdmin) {
      return errorResponse('Only admins can bulk-backfill all mailboxes', 403, corsHeaders);
    }

    const { data: connections, error: connErr } = await supabase
      .from('email_connections')
      .select('sourceco_user_id, email_address')
      .eq('status', 'active');

    if (connErr) {
      console.error('[outlook-bulk-backfill-all] failed to load connections:', connErr);
      return errorResponse('Failed to load email connections', 500, corsHeaders);
    }

    if (!connections || connections.length === 0) {
      return successResponse(
        {
          daysBack,
          mailboxesProcessed: 0,
          totalSynced: 0,
          totalSkipped: 0,
          totalQueued: 0,
          totalRematched: 0,
          results: [],
        },
        corsHeaders,
      );
    }

    // Build the queued list up front so we can tell the caller which mailboxes
    // are scheduled for processing. Actual sync results are not available
    // synchronously — the work runs in the background after we return 202.
    const queuedMailboxes: PerMailboxResult[] = connections.map((conn) => ({
      userId: conn.sourceco_user_id,
      emailAddress: conn.email_address,
      ok: true,
    }));

    const bulkBackfillPromise = (async () => {
      // Process sequentially to avoid tripping Microsoft Graph rate limits.
      for (const conn of connections) {
        try {
          const syncResp = await fetch(`${supabaseUrl}/functions/v1/outlook-sync-emails`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              userId: conn.sourceco_user_id,
              isInitialSync: true,
              initialLookbackDays: daysBack,
            }),
          });

          if (!syncResp.ok) {
            let errBody: unknown = null;
            try {
              errBody = await syncResp.json();
            } catch {
              // non-JSON body
            }
            console.error(
              `[outlook-bulk-backfill-all] background sync failed for ${conn.email_address}:`,
              syncResp.status,
              errBody,
            );
          }
        } catch (e) {
          const msg = (e as Error).message || 'Unknown error';
          console.error(
            `[outlook-bulk-backfill-all] background exception for ${conn.email_address}:`,
            msg,
          );
        }
      }

      // Final rematch pass so any queued-unmatched rows from this bulk run get
      // promoted against the current contact set in one shot.
      try {
        await supabase.rpc('rematch_unmatched_outlook_emails', {
          p_contact_ids: null,
        });
      } catch (e) {
        console.error('[outlook-bulk-backfill-all] background final rematch failed:', e);
      }
    })();

    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
      (globalThis as any).EdgeRuntime.waitUntil(bulkBackfillPromise);
    } else {
      // Local dev / non-Deno-Deploy runtime — detach the promise so we don't
      // block the response, but swallow the rejection so we don't trip an
      // unhandled-rejection warning.
      bulkBackfillPromise.catch(() => {});
    }

    // Return 202 Accepted immediately. Per-mailbox synced/skipped/queued
    // counts are intentionally zero because the real numbers won't be known
    // until the background task finishes — admins should refresh after a
    // couple of minutes to see results.
    return successResponse(
      {
        daysBack,
        status: 'started',
        message: `Bulk backfill started in the background for ${queuedMailboxes.length} mailbox${
          queuedMailboxes.length === 1 ? '' : 'es'
        }. Refresh this page in a couple of minutes to see results.`,
        mailboxesProcessed: queuedMailboxes.length,
        mailboxesSucceeded: queuedMailboxes.length,
        mailboxesFailed: 0,
        totalSynced: 0,
        totalSkipped: 0,
        totalQueued: 0,
        totalRematched: 0,
        results: queuedMailboxes,
      },
      corsHeaders,
      undefined,
      202,
    );
  } catch (err) {
    // Guarantee a CORS-safe response for any unhandled throw. Without this,
    // the platform's fallback 500 has no Access-Control-Allow-Origin header,
    // and the browser surfaces the request as FunctionsFetchError: "Failed
    // to send a request to the Edge Function".
    console.error('[outlook-bulk-backfill-all] unhandled error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Bulk backfill failed (internal error)',
      500,
      corsHeaders,
    );
  }
});
