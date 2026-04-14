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
 * response returns immediately with status 202 ("accepted").
 *
 * ── PROGRESS + RESUMABILITY ─────────────────────────────────────────────────
 * The function writes an initial progress row to
 * `email_connections.backfill_*` before kicking off the background task,
 * and the sync engine checkpoints those columns after every Microsoft Graph
 * page. Callers poll that row to drive a live progress bar. If the isolate
 * crashes/times out mid-run the row is left with `backfill_status='failed'`
 * and the `backfill_next_link` pointing at the page that was in flight —
 * calling this function again with `resume: true` re-invokes the sync engine
 * from that cursor instead of re-walking the inbox from the top. The
 * idempotent `(microsoft_message_id, contact_id)` upsert on `email_messages`
 * makes resumes safe against partial double-runs.
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

    let body: {
      targetUserId?: string;
      daysBack?: number;
      /**
       * When true, resume an existing `failed` / `running` backfill from its
       * stored `backfill_next_link` checkpoint instead of starting a fresh
       * pull. Used by the "Resume" button on the Outlook settings page.
       * When false, force-restart even over a currently-running row.
       * When omitted, the function refuses to stomp a `running` row.
       */
      resume?: boolean;
    } = {};
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

    // Pull the full progress-state columns so we can decide whether this call
    // is a fresh start or a resume of an in-flight / previously-failed run.
    // When `resume=true` on the request, we carry forward `backfill_since`
    // and `backfill_next_link` from the existing row so the cutoff window
    // doesn't drift forward and we pick up at the last checkpoint instead
    // of re-walking the inbox.
    const { data: connection, error: connErr } = await supabase
      .from('email_connections')
      .select(
        'id, email_address, status, backfill_status, backfill_since, backfill_next_link, backfill_days_back',
      )
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

    // ── Resume vs. fresh start decision ─────────────────────────────────────
    //
    // The caller can pass `resume: true` to explicitly pick up from the last
    // checkpoint (used by the "Resume" button on a failed/stalled run). If
    // the flag is omitted and the row is already `running`, we refuse to
    // stomp the in-flight run — one backfill per mailbox at a time keeps
    // the progress counters meaningful. The operator can force-restart by
    // passing `resume: false` alongside a fresh `daysBack`.
    const isResume = body.resume === true;
    const shouldRefuseDuplicate =
      connection.backfill_status === 'running' && !isResume && body.resume !== false;

    if (shouldRefuseDuplicate) {
      return errorResponse(
        'A backfill is already running for this mailbox. Wait for it to finish or pass resume:true to continue it.',
        409,
        corsHeaders,
      );
    }

    // Compute the effective cutoff + starting cursor + daysBack. On resume we
    // reuse whatever's on the row; on a fresh start we snapshot them now.
    const resumeNextLink =
      isResume && connection.backfill_next_link ? connection.backfill_next_link : undefined;
    const effectiveDaysBack =
      isResume && connection.backfill_days_back ? connection.backfill_days_back : daysBack;
    const effectiveSince =
      isResume && connection.backfill_since
        ? connection.backfill_since
        : new Date(Date.now() - effectiveDaysBack * 24 * 60 * 60 * 1000).toISOString();

    // Initialise (or reset) the progress state row up-front so the frontend
    // can poll it and show a progress bar from t=0. On a fresh start we zero
    // out the counters; on a resume we leave the aggregate counters alone so
    // the UI's "X messages synced" doesn't drop back to zero visually.
    const initState: Record<string, unknown> = {
      backfill_status: 'running',
      backfill_started_at: new Date().toISOString(),
      backfill_completed_at: null,
      backfill_days_back: effectiveDaysBack,
      backfill_since: effectiveSince,
      backfill_error_message: null,
      backfill_heartbeat_at: new Date().toISOString(),
    };
    if (!isResume) {
      initState.backfill_pages_processed = 0;
      initState.backfill_messages_synced = 0;
      initState.backfill_messages_skipped = 0;
      initState.backfill_messages_queued = 0;
      initState.backfill_earliest_seen_at = null;
      initState.backfill_next_link = null;
    }

    const { error: initErr } = await supabase
      .from('email_connections')
      .update(initState)
      .eq('sourceco_user_id', targetUserId);

    if (initErr) {
      console.error('[outlook-backfill-history] progress init failed:', initErr);
      return errorResponse('Failed to initialise backfill progress', 500, corsHeaders);
    }

    // Kick off the deep sync as a TRUE background task. A full historical pull
    // against a mailbox with real volume reliably exceeds the 150-second
    // Supabase edge-function ceiling; awaiting it here causes the platform to
    // kill the request and surface a FunctionInvokeError ("Failed to send a
    // request to the Edge Function") in the browser even though the sync
    // engine itself is fine. We forward our service-role Authorization header
    // so the sync function's `requireServiceRole` check passes.
    const backfillPromise = (async () => {
      let succeeded = false;
      let errorMessage: string | null = null;
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
            initialLookbackDays: effectiveDaysBack,
            backfillSince: effectiveSince,
            resumeFromNextLink: resumeNextLink,
            trackBackfillProgress: true,
          }),
        });

        if (!syncResp.ok) {
          let errBody: unknown = null;
          try {
            errBody = await syncResp.json();
          } catch {
            // non-JSON body
          }
          errorMessage = `Sync call failed with status ${syncResp.status}`;
          console.error(
            '[outlook-backfill-history] background sync call failed:',
            syncResp.status,
            errBody,
          );
          return;
        }

        succeeded = true;

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
        errorMessage = (e as Error).message || 'Background task threw';
        console.error('[outlook-backfill-history] background task threw:', e);
      } finally {
        // Finalize the progress state. On success: status='completed',
        // clear the nextLink (we're done walking). On failure: status='failed'
        // and LEAVE the nextLink in place so the Resume button can pick it up.
        try {
          const finalState: Record<string, unknown> = {
            backfill_completed_at: new Date().toISOString(),
            backfill_heartbeat_at: new Date().toISOString(),
          };
          if (succeeded) {
            finalState.backfill_status = 'completed';
            finalState.backfill_next_link = null;
            finalState.backfill_error_message = null;
          } else {
            finalState.backfill_status = 'failed';
            finalState.backfill_error_message = errorMessage || 'Unknown error';
            // backfill_next_link is intentionally NOT cleared — it's the
            // resume cursor the operator needs to pick up from.
          }
          await supabase
            .from('email_connections')
            .update(finalState)
            .eq('sourceco_user_id', targetUserId);
        } catch (finalErr) {
          console.error('[outlook-backfill-history] failed to finalize progress state:', finalErr);
        }
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
    // should poll `email_connections.backfill_*` to watch progress. The
    // initial progress row was already initialized above, so the UI can pick
    // up a 0% progress bar immediately on the next poll.
    return successResponse(
      {
        targetUserId,
        emailAddress: connection.email_address,
        daysBack: effectiveDaysBack,
        resumed: isResume,
        status: 'started',
        message: isResume
          ? 'Backfill resumed from last checkpoint. Progress will continue updating live on this page.'
          : 'Backfill started in the background. Progress will appear live on this page.',
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
