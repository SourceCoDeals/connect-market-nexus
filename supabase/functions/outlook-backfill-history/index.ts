/**
 * outlook-backfill-history: Triggers a deep historical sync of the caller's
 * Outlook mailbox against an extended lookback window.
 *
 * The initial connect-time sync already pulls 365 days of history by default,
 * which is sufficient for most newly-connected mailboxes. This function lets
 * an admin manually request an even deeper backfill (up to ~10 years) for
 * their own mailbox — or, with admin privileges, for any team member's
 * mailbox — so older Outlook threads can be retroactively linked to
 * contacts and deals.
 *
 * It also re-runs the `rematch_unmatched_outlook_emails` RPC afterwards so
 * that any emails captured into the unmatched queue during the backfill are
 * immediately promoted against the current contact set.
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

  const daysBack = Math.max(1, Math.min(Number(body.daysBack) || DEFAULT_DAYS_BACK, MAX_DAYS_BACK));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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

  const { data: connection } = await supabase
    .from('email_connections')
    .select('id, email_address, status')
    .eq('sourceco_user_id', targetUserId)
    .maybeSingle();

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

  // Kick off the deep sync via the existing sync function. We forward our
  // service-role Authorization header so the sync function's
  // `requireServiceRole` check passes.
  const syncResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/outlook-sync-emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      userId: targetUserId,
      isInitialSync: true,
      initialLookbackDays: daysBack,
    }),
  });

  let syncResult: unknown = null;
  try {
    syncResult = await syncResp.json();
  } catch {
    // Non-JSON response — leave syncResult null.
  }

  if (!syncResp.ok) {
    console.error('[outlook-backfill-history] sync call failed:', syncResp.status, syncResult);
    return errorResponse(`Historical sync failed: ${syncResp.status}`, 502, corsHeaders);
  }

  // After the pull, promote any rows the sync engine placed in the unmatched
  // queue so they land against today's contact set immediately.
  let rematchedCount = 0;
  try {
    const { data } = await supabase.rpc('rematch_unmatched_outlook_emails', {
      p_contact_ids: null,
    });
    rematchedCount = (data as number) || 0;
  } catch (e) {
    console.error('[outlook-backfill-history] rematch failed:', e);
  }

  return successResponse(
    {
      targetUserId,
      emailAddress: connection.email_address,
      daysBack,
      syncResult,
      rematchedFromUnmatchedQueue: rematchedCount,
    },
    corsHeaders,
  );
});
