/**
 * outlook-backfill-history: Triggers a deep historical sync of the caller's
 * Outlook mailbox against an extended lookback window.
 *
 * The initial connect-time sync already pulls 30 days of history by default,
 * which is sufficient for most newly-connected mailboxes. This function lets
 * an admin manually request an even deeper backfill (up to ~10 years) for
 * their own mailbox — or, with admin privileges, for any team member's
 * mailbox — so older Outlook threads can be retroactively linked to
 * contacts and deals.
 *
 * It also re-runs the `rematch_unmatched_outlook_emails` RPC afterwards so
 * that any emails captured into the unmatched queue during the backfill are
 * immediately promoted against the current contact set.
 *
 * IMPORTANT: The sync + rematch run as a TRUE background task via
 * `EdgeRuntime.waitUntil` because a full historical sync against a busy
 * mailbox reliably exceeds Supabase's hard 150-second edge-function ceiling.
 * Before this fix the request awaited the sync synchronously, so every
 * backfill invocation surfaced as "Failed to send a request to the Edge
 * Function" in the UI even though the connection row was fine. The HTTP
 * response returns immediately with status 202 ("accepted") so the browser
 * can reflect that the backfill is running; the caller should poll
 * `email_connections.last_sync_at` or just refresh after a couple of minutes
 * to see the imported emails.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { successResponse, errorResponse } from '../_shared/response-helpers.ts';

const DEFAULT_DAYS_BACK = 365;
const MAX_DAYS_BACK = 3650; // ~10 years, matches outlook-sync-emails ceiling.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  // CRITICAL: everything below must run inside the outer try/catch. Before this
  // guard landed, an unhandled throw from `requireAuth`, `createClient`, the
  // `is_admin` RPC, the `email_connections` SELECT, or any DB hiccup crashed
  // the isolate. Deno Deploy then serves a platform 500 with NO CORS headers,
  // which the browser rejects as a cross-origin failure — and `supabase.functions.invoke`
  // surfaces that exact condition as `FunctionsFetchError: "Failed to send a
  // request to the Edge Function"`, the error seen in the Outlook settings page.
  // Wrapping the handler and always returning via `errorResponse` (which
  // *does* include the CORS headers) is what finally makes the failure
  // readable to the frontend.
  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405, corsHeaders);
    }

    const auth = await requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
      return errorResponse(auth.error || 'Authentication required', 401, corsHeaders);
    }

    let body: { targetUserId?: string; daysBack?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine — caller will backfill their own mailbox with default lookback.
    }

    const daysBack = Math.max(
      1,
      Math.min(Number(body.daysBack) || DEFAULT_DAYS_BACK, MAX_DAYS_BACK),
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[outlook-backfill-history] missing SUPABASE_URL or SERVICE_ROLE_KEY env');
      return errorResponse('Backfill not configured on the server', 500, corsHeaders);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine which mailbox we're backfilling.
    let targetUserId = auth.userId;
    if (body.targetUserId && body.targetUserId !== auth.userId) {
      const { data: isAdmin } = await supabase.rpc('is_admin', { user_id: auth.userId });
      if (!isAdmin) {
        return errorResponse(
          'Only admins can backfill other team members mailboxes',
          403,
          corsHeaders,
        );
      }
      targetUserId = body.targetUserId;
    }

    const { data: connection, error: connErr } = await supabase
      .from('email_connections')
      .select('id, email_address, status')
      .eq('sourceco_user_id', targetUserId)
      .maybeSingle();

    if (connErr) {
      console.error('[outlook-backfill-history] connection lookup failed:', connErr);
      return errorResponse('Failed to load Outlook connection', 500, corsHeaders);
    }

    if (!connection) {
      return errorResponse('No Outlook connection found for target user', 404, corsHeaders);
    }

    if (connection.status !== 'active') {
      return errorResponse(
        `Cannot backfill: connection status is "${connection.status}". Reconnect Outlook first.`,
        400,
        corsHeaders,
      );
    }

    // Kick off the deep sync as a TRUE background task. A full historical pull
    // against a mailbox with real volume reliably exceeds the 150-second
    // Supabase edge-function ceiling; awaiting it here causes the platform to
    // kill the request and surface a FunctionInvokeError ("Failed to send a
    // request to the Edge Function") in the browser even though the sync
    // engine itself is fine. We forward our service-role Authorization header
    // so the sync function's `requireServiceRole` check passes.
    const backfillPromise = (async () => {
      try {
        const syncResp = await fetch(`${supabaseUrl}/functions/v1/outlook-sync-emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            userId: targetUserId,
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
            '[outlook-backfill-history] background sync call failed:',
            syncResp.status,
            errBody,
          );
          return;
        }

        // After the pull, promote any rows the sync engine placed in the
        // unmatched queue so they land against today's contact set immediately.
        try {
          await supabase.rpc('rematch_unmatched_outlook_emails', {
            p_contact_ids: null,
          });
        } catch (e) {
          console.error('[outlook-backfill-history] background rematch failed:', e);
        }
      } catch (e) {
        console.error('[outlook-backfill-history] background task threw:', e);
      }
    })();

    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
      (globalThis as any).EdgeRuntime.waitUntil(backfillPromise);
    } else {
      // Local dev / non-Deno-Deploy runtime — detach the promise so we don't
      // block the response, but swallow the rejection so we don't trip an
      // unhandled-rejection warning.
      backfillPromise.catch(() => {});
    }

    // Return 202 Accepted immediately. `syncResult` and
    // `rematchedFromUnmatchedQueue` intentionally come back null/0 because the
    // real counts won't be known until the background task finishes — callers
    // should refresh after a couple of minutes to see the imported emails.
    return successResponse(
      {
        targetUserId,
        emailAddress: connection.email_address,
        daysBack,
        status: 'started',
        message:
          'Backfill started in the background. Refresh this page in a couple of minutes to see the imported emails.',
        syncResult: null,
        rematchedFromUnmatchedQueue: 0,
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
    console.error('[outlook-backfill-history] unhandled error:', err);
    return errorResponse(
      err instanceof Error ? err.message : 'Backfill failed (internal error)',
      500,
      corsHeaders,
    );
  }
});
