/**
 * Backfill Valuation Lead Contacts — sequential, queue-backed, resumable runner.
 *
 * Architecture
 * ------------
 *  • One bulk run = one row in `contact_backfill_runs` + N rows in
 *    `contact_backfill_queue` (one per eligible lead).
 *  • The HTTP request creates the run + enqueues all leads, then schedules a
 *    background worker via `EdgeRuntime.waitUntil()` and returns 202 with the
 *    real `run_id`. The browser can close immediately.
 *  • The background worker leases pending queue items ONE AT A TIME, calls
 *    `find-valuation-lead-contacts`, and persists the result back to the queue
 *    row + run counters. No parallel fan-out, no self-chaining loop —
 *    everything is checkpointed in the database, so a fresh invocation can
 *    resume cleanly via `?resume_run=...`.
 *  • Rate-limit failures (HTTP 429 OR thrown `Rate limit exceeded for trace`
 *    exceptions) trigger exponential backoff with jitter, bounded retries,
 *    and a soft pause that marks the run `needs_resume` instead of dropping
 *    leads.
 *
 * POST /backfill-valuation-lead-contacts
 *   Body: { dry_run?: boolean, resume_run_id?: string }
 *   Auth: admin JWT or x-internal-secret = SERVICE_ROLE_KEY
 *
 * Response (≤1s):
 *   { started, eligible_count, dry_run, run_id }
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, corsPreflightResponse } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/auth.ts';

interface BackfillRequest {
  dry_run?: boolean;
  resume_run_id?: string;
}

interface QueueItem {
  id: string;
  valuation_lead_id: string;
  attempts: number;
}

interface EligibleLead {
  id: string;
  full_name: string | null;
  email: string | null;
  website: string | null;
  business_name: string | null;
  linkedin_url: string | null;
  phone: string | null;
}

// Pacing — sequential, gentle, trace-safe.
const INTER_CALL_DELAY_MS = 600;
const MAX_PER_LEAD_ATTEMPTS = 4;
const RATE_LIMIT_BACKOFF_MS = [1500, 5000, 15000, 45000];
const HEARTBEAT_EVERY_N = 3;
// Hard ceiling to avoid running over the platform's per-invocation wall clock.
// At ~600ms + ~1-3s per find-call, ~1500 leads ≈ 25 min. We resume the rest.
const MAX_LEADS_PER_INVOCATION = 800;
// If we hit this many consecutive trace rate-limit failures, stop and mark
// the run `needs_resume` so a follow-up invocation can pick it up cleanly.
const CONSECUTIVE_RATE_LIMIT_PAUSE = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function jitter(ms: number): number {
  return Math.round(ms * (0.85 + Math.random() * 0.3));
}

function isRateLimitMessage(msg: string): boolean {
  const lc = msg.toLowerCase();
  return (
    lc.includes('rate limit') ||
    lc.includes('rate_limit') ||
    lc.includes('too many requests') ||
    lc.includes('rate limit exceeded for trace')
  );
}

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse(req);

  const corsHeaders = getCorsHeaders(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Auth
  const internalSecret = req.headers.get('x-internal-secret');
  const isServiceCall = internalSecret === supabaseServiceKey;
  let triggeredBy: string | null = null;
  if (!isServiceCall) {
    const auth = await requireAdmin(req, supabaseAdmin);
    if (!auth.authenticated || !auth.isAdmin) {
      return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
        status: auth.authenticated ? 403 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    triggeredBy = auth.userId ?? null;
  }

  // Body
  let body: BackfillRequest = {};
  try {
    if (req.headers.get('content-length') !== '0') {
      body = (await req.json()) as BackfillRequest;
    }
  } catch {
    /* ignore */
  }

  const dryRun = body.dry_run === true;
  const resumeRunId = body.resume_run_id;

  // Resume path -------------------------------------------------------------
  if (resumeRunId) {
    const { data: run, error: runErr } = await supabaseAdmin
      .from('contact_backfill_runs')
      .select('id, status')
      .eq('id', resumeRunId)
      .maybeSingle();
    if (runErr || !run) {
      return jsonResponse(corsHeaders, 404, { error: 'Run not found', details: runErr?.message });
    }
    if (run.status === 'completed') {
      return jsonResponse(corsHeaders, 200, {
        started: false,
        run_id: resumeRunId,
        message: 'Run already completed',
      });
    }
    const { count: pending } = await supabaseAdmin
      .from('contact_backfill_queue')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', resumeRunId)
      .eq('status', 'pending');
    await supabaseAdmin
      .from('contact_backfill_runs')
      .update({
        status: 'running',
        pending_count: pending ?? 0,
        pause_reason: null,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('id', resumeRunId);
    scheduleWorker(supabaseUrl, supabaseServiceKey, resumeRunId);
    return jsonResponse(corsHeaders, 202, {
      started: true,
      run_id: resumeRunId,
      eligible_count: pending ?? 0,
      resumed: true,
    });
  }

  // New-run path ------------------------------------------------------------
  // De-dupe: if a run for this kind is already running and was started in the
  // last 30 minutes, return it instead of spawning a duplicate. This prevents
  // double-clicks from creating two competing workers that race for the same
  // queue items.
  {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: activeRun } = await supabaseAdmin
      .from('contact_backfill_runs')
      .select('id, eligible_count, pending_count, started_at')
      .eq('run_kind', 'valuation_leads')
      .eq('status', 'running')
      .gte('started_at', thirtyMinAgo)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeRun?.id) {
      console.log(`[backfill] De-duped — returning active run ${activeRun.id}`);
      return jsonResponse(corsHeaders, 200, {
        started: false,
        deduped: true,
        run_id: activeRun.id,
        eligible_count: activeRun.eligible_count ?? 0,
        pending_count: activeRun.pending_count ?? 0,
        message: 'A backfill run is already in progress',
      });
    }
  }

  const { data: backlog, error: backlogErr } = await fetchEligibleLeads(supabaseAdmin);
  if (backlogErr) {
    return jsonResponse(corsHeaders, 500, {
      error: 'Failed to query eligible leads',
      details: backlogErr.message,
    });
  }
  const eligible = backlog ?? [];

  // Always create a run row so the client has durable proof of kickoff.
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from('contact_backfill_runs')
    .insert({
      run_kind: 'valuation_leads',
      triggered_by: triggeredBy,
      status: dryRun || eligible.length === 0 ? 'completed' : 'running',
      eligible_count: eligible.length,
      pending_count: dryRun ? 0 : eligible.length,
      chain_depth: 0,
      notes: { dry_run: dryRun, mode: 'queue_v2' },
      completed_at: dryRun || eligible.length === 0 ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    console.error('[backfill] Run creation failed:', runErr?.message);
    return jsonResponse(corsHeaders, 500, {
      error: 'Failed to create run record',
      details: runErr?.message,
    });
  }

  const runId = runRow.id as string;
  console.log(`[backfill] Run ${runId} created — ${eligible.length} eligible (dry_run=${dryRun})`);

  if (dryRun || eligible.length === 0) {
    return jsonResponse(corsHeaders, 200, {
      started: false,
      eligible_count: eligible.length,
      dry_run: dryRun,
      run_id: runId,
    });
  }

  // Enqueue all leads in chunks (Postgres parameter limit is generous, but be safe).
  const ENQUEUE_CHUNK = 500;
  for (let i = 0; i < eligible.length; i += ENQUEUE_CHUNK) {
    const slice = eligible.slice(i, i + ENQUEUE_CHUNK).map((l) => ({
      run_id: runId,
      valuation_lead_id: l.id,
      status: 'pending' as const,
    }));
    const { error: enqueueErr } = await supabaseAdmin.from('contact_backfill_queue').insert(slice);
    if (enqueueErr) {
      console.error(`[backfill] Enqueue failed: ${enqueueErr.message}`);
      await supabaseAdmin
        .from('contact_backfill_runs')
        .update({
          status: 'failed',
          error: `Enqueue failed: ${enqueueErr.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
      return jsonResponse(corsHeaders, 500, {
        error: 'Failed to enqueue leads',
        details: enqueueErr.message,
      });
    }
  }

  scheduleWorker(supabaseUrl, supabaseServiceKey, runId);

  return jsonResponse(corsHeaders, 202, {
    started: true,
    eligible_count: eligible.length,
    dry_run: false,
    run_id: runId,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  corsHeaders: Record<string, string>,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** CANONICAL eligibility predicate — must match the UI predicate exactly. */
async function fetchEligibleLeads(
  supabaseAdmin: SupabaseClient,
): Promise<{ data: EligibleLead[] | null; error: { message: string } | null }> {
  const all: EligibleLead[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('valuation_leads')
      .select('id, full_name, email, website, business_name, linkedin_url, phone')
      .or('linkedin_url.is.null,phone.is.null')
      .not('full_name', 'is', null)
      .not('email', 'is', null)
      .eq('excluded', false)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    const rows = (data ?? []) as EligibleLead[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return { data: all, error: null };
}

function scheduleWorker(supabaseUrl: string, serviceKey: string, runId: string): void {
  const work = runWorker(supabaseUrl, serviceKey, runId);
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    work.catch((err) => console.error(`[backfill] Worker crashed for run ${runId}:`, err));
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

async function runWorker(supabaseUrl: string, serviceKey: string, runId: string): Promise<void> {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const startedAt = Date.now();

  const stats = {
    processed: 0,
    found_phone: 0,
    found_linkedin: 0,
    queued: 0,
    failed: 0,
    rate_limited_retried: 0,
    rate_limited_dropped: 0,
  };
  let processedSinceHeartbeat = 0;
  let consecutiveRateLimits = 0;

  console.log(`[backfill] BG worker start run=${runId}`);

  // We loop, leasing one item at a time, until the queue is empty or a
  // pause/limit condition triggers.
  for (
    let leadsThisInvocation = 0;
    leadsThisInvocation < MAX_LEADS_PER_INVOCATION;
    leadsThisInvocation++
  ) {
    const item = await leaseNextPending(supabaseAdmin, runId);
    if (!item) break;

    const lead = await loadLead(supabaseAdmin, item.valuation_lead_id);
    if (!lead) {
      await markQueueItem(supabaseAdmin, item.id, 'skipped', { reason: 'lead_missing' });
      stats.processed++;
      continue;
    }

    let outcome: 'completed' | 'failed' | 'paused' = 'failed';
    let lastError: string | null = null;
    let result: Record<string, unknown> | null = null;

    for (let attempt = item.attempts; attempt < MAX_PER_LEAD_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/find-valuation-lead-contacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            valuation_lead_id: lead.id,
            full_name: lead.full_name,
            email: lead.email,
            website: lead.website || undefined,
            business_name: lead.business_name || undefined,
          }),
        });

        const bodyText = await res.text();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          /* ignore */
        }

        if (res.ok) {
          result = parsed;
          outcome = 'completed';
          consecutiveRateLimits = 0;

          // Trust the find function's explicit "persisted" booleans when
          // present (current contract). Fall back to the legacy heuristic
          // (returned-value AND was-missing-on-snapshot) for older deploys.
          const persistedLi = parsed.linkedin_persisted as boolean | undefined;
          const persistedPh = parsed.phone_persisted as boolean | undefined;
          const li = parsed.linkedin_url as string | null | undefined;
          const ph = parsed.phone as string | null | undefined;
          if (typeof persistedLi === 'boolean') {
            if (persistedLi) stats.found_linkedin++;
          } else if (li && !lead.linkedin_url) {
            stats.found_linkedin++;
          }
          if (typeof persistedPh === 'boolean') {
            if (persistedPh) stats.found_phone++;
          } else if (ph && !lead.phone) {
            stats.found_phone++;
          }
          if (parsed.clay_fallback_sent) stats.queued++;
          break;
        }

        // Non-OK: distinguish rate limit from hard error
        if (res.status === 429 || isRateLimitMessage(bodyText)) {
          stats.rate_limited_retried++;
          consecutiveRateLimits++;
          const delay = jitter(
            RATE_LIMIT_BACKOFF_MS[Math.min(attempt, RATE_LIMIT_BACKOFF_MS.length - 1)],
          );
          console.warn(
            `[backfill] [run=${runId}] lead=${lead.id} rate-limited (status=${res.status}) attempt=${attempt + 1} — sleep ${delay}ms`,
          );
          // Persist attempt count + last error so we can resume cleanly.
          await supabaseAdmin
            .from('contact_backfill_queue')
            .update({
              attempts: attempt + 1,
              last_error: `rl status=${res.status}: ${bodyText.slice(0, 200)}`,
            })
            .eq('id', item.id);
          await sleep(delay);

          if (consecutiveRateLimits >= CONSECUTIVE_RATE_LIMIT_PAUSE) {
            outcome = 'paused';
            lastError = `Paused after ${consecutiveRateLimits} consecutive rate-limit failures`;
            break;
          }
          continue;
        }

        // Hard error — record and break
        lastError = `HTTP ${res.status}: ${bodyText.slice(0, 300)}`;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isRateLimitMessage(msg)) {
          stats.rate_limited_retried++;
          consecutiveRateLimits++;
          const delay = jitter(
            RATE_LIMIT_BACKOFF_MS[Math.min(attempt, RATE_LIMIT_BACKOFF_MS.length - 1)],
          );
          console.warn(
            `[backfill] [run=${runId}] lead=${lead.id} trace rate-limit thrown attempt=${attempt + 1} — sleep ${delay}ms`,
          );
          await supabaseAdmin
            .from('contact_backfill_queue')
            .update({ attempts: attempt + 1, last_error: `trace_rl: ${msg.slice(0, 200)}` })
            .eq('id', item.id);
          await sleep(delay);
          if (consecutiveRateLimits >= CONSECUTIVE_RATE_LIMIT_PAUSE) {
            outcome = 'paused';
            lastError = `Paused after ${consecutiveRateLimits} consecutive trace rate-limits`;
            break;
          }
          continue;
        }
        // Non-retryable exception
        lastError = `EXCEPTION: ${msg.slice(0, 300)}`;
        break;
      }
    }

    if (outcome === 'paused') {
      // Put the lease back so it can be picked up on resume.
      await supabaseAdmin
        .from('contact_backfill_queue')
        .update({ status: 'pending', last_error: lastError, started_at: null })
        .eq('id', item.id);
      stats.rate_limited_dropped++;
      await markRunPaused(supabaseAdmin, runId, lastError ?? 'rate_limited');
      await persistHeartbeat(supabaseAdmin, runId, stats);
      console.warn(`[backfill] Run ${runId} PAUSED — needs_resume`);
      return;
    }

    if (outcome === 'completed') {
      await markQueueItem(supabaseAdmin, item.id, 'completed', result);
    } else {
      stats.failed++;
      await markQueueItem(supabaseAdmin, item.id, 'failed', { error: lastError });
    }
    stats.processed++;

    processedSinceHeartbeat++;
    if (processedSinceHeartbeat >= HEARTBEAT_EVERY_N) {
      processedSinceHeartbeat = 0;
      await persistHeartbeat(supabaseAdmin, runId, stats);
    }

    await sleep(INTER_CALL_DELAY_MS);
  }

  await persistHeartbeat(supabaseAdmin, runId, stats);

  // Are we done, or should we re-invoke ourselves to keep going?
  const { count: stillPending } = await supabaseAdmin
    .from('contact_backfill_queue')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('status', 'pending');

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[backfill] BG slice complete in ${elapsed}s run=${runId} processed=${stats.processed} found_li=${stats.found_linkedin} found_ph=${stats.found_phone} failed=${stats.failed} pending=${stillPending ?? 0}`,
  );

  if (!stillPending || stillPending === 0) {
    await supabaseAdmin
      .from('contact_backfill_runs')
      .update({
        status: 'completed',
        pending_count: 0,
        completed_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('id', runId);
    return;
  }

  // Re-invoke ourselves with resume_run_id — single follow-up call, NOT a
  // tight loop, so no trace explosion.
  console.log(`[backfill] Re-invoking self to resume run=${runId} (${stillPending} pending)`);
  fetch(`${supabaseUrl}/functions/v1/backfill-valuation-lead-contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ resume_run_id: runId }),
  }).catch((err) => {
    console.error(
      `[backfill] Resume self-invoke failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
}

async function leaseNextPending(
  supabaseAdmin: SupabaseClient,
  runId: string,
): Promise<QueueItem | null> {
  // Atomic-ish lease: pick one pending row, mark it processing.
  // (Single worker per run, so we don't need SKIP LOCKED.)
  const { data: candidates, error } = await supabaseAdmin
    .from('contact_backfill_queue')
    .select('id, valuation_lead_id, attempts')
    .eq('run_id', runId)
    .eq('status', 'pending')
    .order('enqueued_at', { ascending: true })
    .limit(1);
  if (error || !candidates || candidates.length === 0) return null;
  const item = candidates[0] as QueueItem;
  await supabaseAdmin
    .from('contact_backfill_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', item.id);
  return item;
}

async function loadLead(
  supabaseAdmin: SupabaseClient,
  leadId: string,
): Promise<EligibleLead | null> {
  const { data, error } = await supabaseAdmin
    .from('valuation_leads')
    .select('id, full_name, email, website, business_name, linkedin_url, phone')
    .eq('id', leadId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EligibleLead;
}

async function markQueueItem(
  supabaseAdmin: SupabaseClient,
  itemId: string,
  status: 'completed' | 'failed' | 'skipped',
  result: Record<string, unknown> | null,
): Promise<void> {
  await supabaseAdmin
    .from('contact_backfill_queue')
    .update({
      status,
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', itemId);
}

async function persistHeartbeat(
  supabaseAdmin: SupabaseClient,
  runId: string,
  stats: {
    processed: number;
    found_phone: number;
    found_linkedin: number;
    queued: number;
    failed: number;
    rate_limited_retried: number;
    rate_limited_dropped: number;
  },
): Promise<void> {
  // Recompute pending from the queue so the UI always sees truth, not deltas.
  const { count: pending } = await supabaseAdmin
    .from('contact_backfill_queue')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('status', 'pending');

  await supabaseAdmin
    .from('contact_backfill_runs')
    .update({
      processed_count: stats.processed,
      found_phone_count: stats.found_phone,
      found_linkedin_count: stats.found_linkedin,
      queued_clay_count: stats.queued,
      failed_count: stats.failed,
      rate_limited_retried: stats.rate_limited_retried,
      rate_limited_dropped: stats.rate_limited_dropped,
      pending_count: pending ?? 0,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

async function markRunPaused(
  supabaseAdmin: SupabaseClient,
  runId: string,
  reason: string,
): Promise<void> {
  await supabaseAdmin
    .from('contact_backfill_runs')
    .update({
      status: 'needs_resume',
      pause_reason: reason,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('id', runId);
}
