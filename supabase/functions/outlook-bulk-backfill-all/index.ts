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

  const daysBack = Math.max(1, Math.min(Number(body.daysBack) || DEFAULT_DAYS_BACK, MAX_DAYS_BACK));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const results: PerMailboxResult[] = [];

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

      let syncJson: {
        data?: { synced?: number; skipped?: number; queuedUnmatched?: number };
        error?: string;
      } | null = null;
      try {
        syncJson = await syncResp.json();
      } catch {
        // non-JSON body — leave null
      }

      if (!syncResp.ok) {
        const errMsg = syncJson?.error || `HTTP ${syncResp.status}`;
        console.error(`[outlook-bulk-backfill-all] sync failed for ${conn.email_address}:`, errMsg);
        results.push({
          userId: conn.sourceco_user_id,
          emailAddress: conn.email_address,
          ok: false,
          error: errMsg,
        });
        continue;
      }

      results.push({
        userId: conn.sourceco_user_id,
        emailAddress: conn.email_address,
        ok: true,
        synced: syncJson?.data?.synced ?? 0,
        skipped: syncJson?.data?.skipped ?? 0,
        queuedUnmatched: syncJson?.data?.queuedUnmatched ?? 0,
      });
    } catch (e) {
      const msg = (e as Error).message || 'Unknown error';
      console.error(`[outlook-bulk-backfill-all] exception for ${conn.email_address}:`, msg);
      results.push({
        userId: conn.sourceco_user_id,
        emailAddress: conn.email_address,
        ok: false,
        error: msg,
      });
    }
  }

  // Final rematch pass so any queued-unmatched rows from this bulk run get
  // promoted against the current contact set in one shot.
  let rematchedCount = 0;
  try {
    const { data } = await supabase.rpc('rematch_unmatched_outlook_emails', {
      p_contact_ids: null,
    });
    rematchedCount = (data as number) || 0;
  } catch (e) {
    console.error('[outlook-bulk-backfill-all] final rematch failed:', e);
  }

  const totalSynced = results.reduce((acc, r) => acc + (r.synced ?? 0), 0);
  const totalSkipped = results.reduce((acc, r) => acc + (r.skipped ?? 0), 0);
  const totalQueued = results.reduce((acc, r) => acc + (r.queuedUnmatched ?? 0), 0);
  const failures = results.filter((r) => !r.ok).length;

  return successResponse(
    {
      daysBack,
      mailboxesProcessed: results.length,
      mailboxesSucceeded: results.length - failures,
      mailboxesFailed: failures,
      totalSynced,
      totalSkipped,
      totalQueued,
      totalRematched: rematchedCount,
      results,
    },
    corsHeaders,
  );
});
