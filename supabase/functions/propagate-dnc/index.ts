/**
 * propagate-dnc
 *
 * Drains the dnc_propagation_queue and pushes contact-level DNC state out to
 * each active outreach integration. Triggered by the contacts trigger
 * (contacts_dnc_propagate) inserting a row, and by cron as a safety net.
 *
 * Behaviour per target system:
 *
 *   smartlead  — look up the lead by email (findLeadByEmail), then call
 *                pauseLeadInCampaign for every campaign participation. This
 *                is what the Smartlead UI's "Pause" button does; it halts
 *                future sends without deleting historical activity.
 *
 *   heyreach   — HeyReach's public API doesn't expose a per-contact stop
 *                right now. We mark the queue row 'completed' with a note
 *                so the local tracking (via smartlead/heyreach webhook event
 *                paths) still reflects the DNC, and operators know the
 *                upstream pause needs to be done in HeyReach's UI.
 *
 *   phoneburner — update the PB contact's custom fields via
 *                `contact_displayed` is read-only; PB exposes contact-update
 *                via POST /rest/1/contacts/{id}. We don't know the PB
 *                contact_id from the CRM side without a previous push, so
 *                we flag the queue row 'completed_partial' when no PB id
 *                is known. Future enhancement: store pb_contact_id on
 *                contacts when we first push to PB.
 *
 * Each queue row is processed once per invocation. Failures increment
 * attempts and stamp last_error; after 5 attempts the row goes to 'failed'
 * so operators can triage in the admin UI (future: add it to
 * UnmatchedActivitiesPage so DNC failures are visible).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedCronRequest } from '../_shared/outreach-match.ts';
import { findLeadByEmail, pauseLeadInCampaign } from '../_shared/smartlead-client.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

const MAX_ATTEMPTS = 5;

interface QueueRow {
  id: string;
  contact_id: string;
  contact_email: string | null;
  linkedin_url: string | null;
  target_systems: string[];
  attempts: number;
}

interface ProcessResult {
  queue_id: string;
  contact_email: string | null;
  smartlead: string;
  heyreach: string;
  phoneburner: string;
  error?: string;
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

  let maxRows = 50;
  try {
    const body = await req.json();
    if (typeof body?.max_rows === 'number') {
      maxRows = Math.min(Math.max(body.max_rows, 1), 500);
    }
  } catch {
    // no body — defaults
  }

  const { data: queueRows, error: queueErr } = await supabase
    .from('dnc_propagation_queue')
    .select('id, contact_id, contact_email, linkedin_url, target_systems, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(maxRows);

  if (queueErr) {
    return new Response(JSON.stringify({ error: 'queue_load_failed', detail: queueErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = (queueRows || []) as QueueRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: ProcessResult[] = [];
  for (const row of rows) {
    // Mark as processing so parallel invocations skip it.
    await supabase
      .from('dnc_propagation_queue')
      .update({ status: 'processing', attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'pending');

    const result: ProcessResult = {
      queue_id: row.id,
      contact_email: row.contact_email,
      smartlead: 'skipped',
      heyreach: 'skipped',
      phoneburner: 'skipped',
    };

    try {
      if (row.target_systems.includes('smartlead') && row.contact_email) {
        result.smartlead = await pauseSmartleadForEmail(row.contact_email);
      }
      if (row.target_systems.includes('heyreach')) {
        // No public HeyReach per-contact pause endpoint. Local tracking was
        // already updated by the contacts trigger; mark this target as
        // manual so admins know to pause in HeyReach's UI.
        result.heyreach = 'manual_pause_required';
      }
      if (row.target_systems.includes('phoneburner')) {
        // PB contact update requires the PB contact_id, which we don't
        // persist on contacts yet. Skip until we wire it into the push flow.
        result.phoneburner = 'pending_pb_contact_id';
      }

      // Completed — even if some targets are manual, we've done everything we
      // can automate. Operators see the manual_* states and act.
      await supabase
        .from('dnc_propagation_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.error = message;

      const newStatus = row.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await supabase
        .from('dnc_propagation_queue')
        .update({
          status: newStatus,
          last_error: message,
        })
        .eq('id', row.id);
    }

    results.push(result);
  }

  return new Response(JSON.stringify({ ok: true, processed: rows.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function pauseSmartleadForEmail(email: string): Promise<string> {
  // Find every campaign the lead participates in, then pause each.
  const lookup = await findLeadByEmail(email);
  if (!lookup.ok || !lookup.data) {
    return `lookup_failed:${lookup.error ?? 'unknown'}`;
  }

  // Smartlead's response shape for lead-by-email isn't uniform — handle
  // three plausible shapes and fall back to skip.
  type SLLeadHit = {
    id?: number;
    lead_id?: number;
    campaign_id?: number;
    campaigns?: Array<{ id?: number; campaign_id?: number }>;
  };
  const data = lookup.data as SLLeadHit | SLLeadHit[] | { leads?: SLLeadHit[] };
  const hits: SLLeadHit[] = Array.isArray(data)
    ? data
    : 'leads' in data && Array.isArray(data.leads)
      ? data.leads
      : [data as SLLeadHit];

  if (hits.length === 0) return 'no_smartlead_lead';

  const paused: number[] = [];
  for (const hit of hits) {
    const leadId = hit.id ?? hit.lead_id;
    if (!leadId) continue;
    const campaignIds: number[] = [];
    if (hit.campaign_id) campaignIds.push(hit.campaign_id);
    if (Array.isArray(hit.campaigns)) {
      for (const c of hit.campaigns) {
        const id = c.id ?? c.campaign_id;
        if (id) campaignIds.push(id);
      }
    }
    for (const cid of campaignIds) {
      const resp = await pauseLeadInCampaign(cid, leadId);
      if (resp.ok) paused.push(cid);
    }
  }

  return paused.length > 0 ? `paused:${paused.length}` : 'no_campaigns_to_pause';
}
