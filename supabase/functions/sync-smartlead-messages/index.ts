/**
 * sync-smartlead-messages
 *
 * Forward-sync worker that pulls new SmartLead email activity into
 * `smartlead_messages` and `smartlead_unmatched_messages`. Runs every 20 min
 * via pg_cron.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET or admin JWT)
 *   2. Fetch active campaigns from local `smartlead_campaigns` table
 *   3. For each campaign:
 *      a. Read/create outreach_sync_state row
 *      b. Mark running
 *      c. Paginate through campaign leads
 *      d. For each lead with updated activity: fetch message-history, resolve
 *         contact, upsert messages (or park in unmatched queue)
 *      e. Update outreach_sync_state with new high-water mark
 *   4. Return summary
 *
 * Dedup is enforced by the UNIQUE constraint on
 * (smartlead_message_id, contact_id). The worker upserts with ON CONFLICT DO
 * NOTHING, so running the sync multiple times in a row is a no-op.
 *
 * NEVER auto-creates contacts. Unmatched records go to
 * smartlead_unmatched_messages for later resolution.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getLeadMessageHistory, listCampaignLeads } from '../_shared/smartlead-client.ts';
import {
  isAuthorizedCronRequest,
  resolveOutreachContact,
  normalizeEmail,
  type OutreachAnchor,
  type UnmatchedReason,
} from '../_shared/outreach-match.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

interface CampaignRow {
  id: string;
  smartlead_campaign_id: number;
  name: string;
  status: string;
}

interface SmartleadLead {
  id?: number;
  lead_id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  linkedin_profile?: string;
  linkedin_url?: string;
  updated_at?: string;
  last_updated_at?: string;
  created_at?: string;
  // Wrapper shape variants — SmartLead's lead list is inconsistent
  lead?: SmartleadLead;
}

interface MessageHistoryEntry {
  type?: string; // 'SENT' | 'REPLY'
  message_id?: string;
  email_message_id?: string;
  time?: string;
  email_body?: string;
  body?: string;
  subject?: string;
  email_seq_number?: number;
  sequence?: number;
  from?: string;
  from_email?: string;
  to?: string;
  to_email?: string;
  cc?: string;
  stats?: Record<string, unknown>;
  opened?: boolean;
  clicked?: boolean;
  replied?: boolean;
  bounced?: boolean;
  unsubscribed?: boolean;
  open_count?: number;
  click_count?: number;
}

interface MessageHistoryResponse {
  history?: MessageHistoryEntry[];
  messages?: MessageHistoryEntry[];
  data?: MessageHistoryEntry[];
}

type CampaignSyncResult = {
  campaign_id: number;
  leads_scanned: number;
  messages_upserted: number;
  unmatched: number;
  errors: number;
  duration_ms: number;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

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

  // Optional: restrict to a single campaign via JSON body for testing/manual runs
  let filterCampaignId: number | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.campaign_id === 'number') {
      filterCampaignId = body.campaign_id;
    }
  } catch {
    // No body — run full sync across all active campaigns
  }

  const startedAt = Date.now();
  console.log(
    `[sync-smartlead-messages] starting${filterCampaignId ? ` (single campaign ${filterCampaignId})` : ''}`,
  );

  // Fetch campaigns to sync
  let campaignQuery = supabase
    .from('smartlead_campaigns')
    .select('id, smartlead_campaign_id, name, status')
    .in('status', ['active', 'paused', 'running']); // include paused — still want to sync historical replies

  if (filterCampaignId !== null) {
    campaignQuery = campaignQuery.eq('smartlead_campaign_id', filterCampaignId);
  }

  const { data: campaignsData, error: campaignsError } = await campaignQuery;
  if (campaignsError) {
    console.error('[sync-smartlead-messages] Failed to load campaigns:', campaignsError.message);
    return new Response(
      JSON.stringify({ error: 'failed_to_load_campaigns', detail: campaignsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const campaigns = (campaignsData || []) as unknown as CampaignRow[];
  console.log(`[sync-smartlead-messages] ${campaigns.length} campaigns to sync`);

  const results: CampaignSyncResult[] = [];

  for (const campaign of campaigns) {
    try {
      const result = await syncCampaign(supabase, campaign);
      results.push(result);
    } catch (err) {
      console.error(
        `[sync-smartlead-messages] Campaign ${campaign.smartlead_campaign_id} crashed:`,
        err instanceof Error ? err.message : err,
      );
      // Mark sync state as error, continue to next campaign
      await supabase.from('outreach_sync_state').upsert(
        {
          channel: 'smartlead',
          external_campaign_id: campaign.smartlead_campaign_id,
          last_sync_attempted_at: new Date().toISOString(),
          sync_status: 'error',
          error_message: err instanceof Error ? err.message : String(err),
        },
        { onConflict: 'channel,external_campaign_id' },
      );
    }
  }

  const totalDuration = Date.now() - startedAt;
  const summary = {
    ok: true,
    campaigns_synced: results.length,
    total_leads_scanned: results.reduce((a, r) => a + r.leads_scanned, 0),
    total_messages_upserted: results.reduce((a, r) => a + r.messages_upserted, 0),
    total_unmatched: results.reduce((a, r) => a + r.unmatched, 0),
    total_errors: results.reduce((a, r) => a + r.errors, 0),
    duration_ms: totalDuration,
    per_campaign: results,
  };

  console.log(
    `[sync-smartlead-messages] done in ${totalDuration}ms — ${summary.total_messages_upserted} new, ${summary.total_unmatched} unmatched`,
  );

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function syncCampaign(
  supabase: SupabaseClient,
  campaign: CampaignRow,
): Promise<CampaignSyncResult> {
  const result: CampaignSyncResult = {
    campaign_id: campaign.smartlead_campaign_id,
    leads_scanned: 0,
    messages_upserted: 0,
    unmatched: 0,
    errors: 0,
    duration_ms: 0,
  };
  const startedAt = Date.now();

  // Load sync state (high-water mark) for this campaign
  const { data: stateRow } = await supabase
    .from('outreach_sync_state')
    .select('last_synced_at, last_synced_message_id')
    .eq('channel', 'smartlead')
    .eq('external_campaign_id', campaign.smartlead_campaign_id)
    .maybeSingle();

  const lastSyncedAt = (stateRow as { last_synced_at: string | null } | null)?.last_synced_at
    ? new Date((stateRow as { last_synced_at: string }).last_synced_at)
    : null;

  // Mark as running
  await supabase.from('outreach_sync_state').upsert(
    {
      channel: 'smartlead',
      external_campaign_id: campaign.smartlead_campaign_id,
      last_sync_attempted_at: new Date().toISOString(),
      sync_status: 'running',
      error_message: null,
    },
    { onConflict: 'channel,external_campaign_id' },
  );

  // Paginate through campaign leads (100 per page is the SmartLead default)
  const PAGE_SIZE = 100;
  let offset = 0;
  let latestActivityAt = lastSyncedAt;

  while (true) {
    const leadsResp = await listCampaignLeads(campaign.smartlead_campaign_id, offset, PAGE_SIZE);
    if (!leadsResp.ok || !leadsResp.data) {
      console.error(
        `[sync-smartlead-messages] Failed to list leads for campaign ${campaign.smartlead_campaign_id}:`,
        leadsResp.error,
      );
      result.errors++;
      break;
    }

    // The response shape varies: may be { data: [...] }, { leads: [...] }, or just [...]
    const rawPayload = leadsResp.data as any;
    const leads: SmartleadLead[] = Array.isArray(rawPayload)
      ? rawPayload
      : rawPayload.data || rawPayload.leads || [];

    if (leads.length === 0) break;

    for (const wrapper of leads) {
      // SmartLead nests the lead in a `lead` subkey sometimes
      const lead = wrapper.lead || wrapper;
      result.leads_scanned++;

      const leadId = lead.id || lead.lead_id;
      if (!leadId) continue;

      // Filter by activity since last sync when possible.
      // Strict < so leads with updated_at exactly at the watermark are re-processed
      // on the next run — the DB UNIQUE constraint silently dedups any true duplicates,
      // so this is safer than strict > (which would skip them entirely).
      const activityAt = lead.updated_at || lead.last_updated_at || lead.created_at;
      if (activityAt && lastSyncedAt) {
        const activityDate = new Date(activityAt);
        if (activityDate < lastSyncedAt) {
          continue; // No new activity since last sync
        }
        if (!latestActivityAt || activityDate > latestActivityAt) {
          latestActivityAt = activityDate;
        }
      } else if (activityAt) {
        const activityDate = new Date(activityAt);
        if (!latestActivityAt || activityDate > latestActivityAt) {
          latestActivityAt = activityDate;
        }
      }

      // Attempt contact resolution before we burn an API call
      const matchResult = await resolveOutreachContact(supabase, {
        email: lead.email,
        linkedin_url: lead.linkedin_url || lead.linkedin_profile,
      });

      // Fetch full message history for this lead
      const historyResp = await getLeadMessageHistory(campaign.smartlead_campaign_id, leadId);
      if (!historyResp.ok || !historyResp.data) {
        console.warn(
          `[sync-smartlead-messages] message-history failed for lead ${leadId}:`,
          historyResp.error,
        );
        result.errors++;
        continue;
      }

      const history = historyResp.data as MessageHistoryResponse;
      // Guard against API returning {data: {}} or similar non-array shapes —
      // || [] isn't enough because a {} is truthy.
      const rawEntries =
        (Array.isArray(history?.history) && history.history) ||
        (Array.isArray(history?.messages) && history.messages) ||
        (Array.isArray(history?.data) && history.data) ||
        [];
      const entries: MessageHistoryEntry[] = rawEntries;

      if (entries.length === 0) continue;

      if (!matchResult.matched) {
        // Park every entry for this lead in unmatched with the lead's signals
        for (const entry of entries) {
          await insertUnmatched(supabase, campaign, lead, entry, matchResult.reason);
          result.unmatched++;
        }
        continue;
      }

      // Upsert each message
      for (const entry of entries) {
        const upserted = await upsertMessage(supabase, campaign, lead, entry, matchResult.anchor);
        if (upserted) result.messages_upserted++;
      }
    }

    if (leads.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  // Update sync state on success. CRITICAL: only advance last_synced_at when
  // we actually observed new activity. If latestActivityAt is null (zero new
  // leads or leads with no timestamp field), preserve the existing watermark
  // to avoid silently skipping records on the next run.
  const syncStateUpdate: Record<string, unknown> = {
    channel: 'smartlead',
    external_campaign_id: campaign.smartlead_campaign_id,
    last_sync_attempted_at: new Date().toISOString(),
    sync_status: 'ok',
    error_message: null,
    messages_synced_total:
      ((stateRow as { messages_synced_total?: number } | null)?.messages_synced_total || 0) +
      result.messages_upserted,
  };
  if (latestActivityAt && (!lastSyncedAt || latestActivityAt > lastSyncedAt)) {
    syncStateUpdate.last_synced_at = latestActivityAt.toISOString();
  }
  await supabase
    .from('outreach_sync_state')
    .upsert(syncStateUpdate, { onConflict: 'channel,external_campaign_id' });

  result.duration_ms = Date.now() - startedAt;
  return result;
}

/** Extract event_type from a raw SmartLead message-history entry. */
function classifyEvent(entry: MessageHistoryEntry): {
  event_type: string;
  direction: 'inbound' | 'outbound';
} {
  const type = (entry.type || '').toUpperCase();
  if (type === 'REPLY' || entry.replied) {
    return { event_type: 'replied', direction: 'inbound' };
  }
  if (entry.bounced) return { event_type: 'bounced', direction: 'outbound' };
  if (entry.unsubscribed) return { event_type: 'unsubscribed', direction: 'outbound' };
  if (entry.clicked || (entry.click_count && entry.click_count > 0)) {
    return { event_type: 'clicked', direction: 'outbound' };
  }
  if (entry.opened || (entry.open_count && entry.open_count > 0)) {
    return { event_type: 'opened', direction: 'outbound' };
  }
  return { event_type: 'sent', direction: 'outbound' };
}

async function upsertMessage(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  lead: SmartleadLead,
  entry: MessageHistoryEntry,
  anchor: OutreachAnchor,
): Promise<boolean> {
  const messageId = entry.message_id || entry.email_message_id;
  if (!messageId) {
    console.warn('[sync-smartlead-messages] skipping entry with no message_id');
    return false;
  }

  const sentAt = entry.time ? new Date(entry.time).toISOString() : new Date().toISOString();
  const { event_type, direction } = classifyEvent(entry);
  const fromAddr = normalizeEmail(entry.from || entry.from_email) || 'unknown@unknown';
  const toAddr = entry.to || entry.to_email;
  const toAddresses = toAddr ? [normalizeEmail(toAddr)].filter(Boolean) : [];
  const ccAddresses = entry.cc
    ? entry.cc
        .split(',')
        .map((e) => normalizeEmail(e.trim()))
        .filter(Boolean)
    : [];

  const row = {
    smartlead_message_id: messageId,
    smartlead_lead_id: lead.id || lead.lead_id || null,
    smartlead_campaign_id: campaign.smartlead_campaign_id,
    contact_id: anchor.contact_id,
    contact_type: anchor.contact_type,
    remarketing_buyer_id: anchor.remarketing_buyer_id,
    listing_id: anchor.listing_id,
    direction,
    from_address: fromAddr,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses,
    subject: entry.subject || null,
    body_html: entry.email_body || null,
    body_text: entry.body || null,
    sent_at: sentAt,
    synced_at: new Date().toISOString(),
    event_type,
    sequence_number: entry.email_seq_number || entry.sequence || null,
    raw_payload: entry as unknown as Record<string, unknown>,
  };

  const { error } = await supabase.from('smartlead_messages').upsert([row], {
    onConflict: 'smartlead_message_id,contact_id',
    ignoreDuplicates: true,
  });

  if (error) {
    // Check constraint failures are expected when contact_type doesn't match the
    // anchor — they're caught earlier, but log just in case
    console.error('[sync-smartlead-messages] upsert failed:', error.message);
    return false;
  }
  return true;
}

async function insertUnmatched(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  lead: SmartleadLead,
  entry: MessageHistoryEntry,
  reason: UnmatchedReason,
): Promise<void> {
  const messageId = entry.message_id || entry.email_message_id || null;
  const leadEmail = normalizeEmail(lead.email);

  // Guard: if we have neither a message_id nor a lead_email, the dedup key is
  // (NULL, NULL) — unique constraint still collapses via NULLS NOT DISTINCT,
  // but we can't meaningfully match this to a future contact either. Drop it.
  if (!messageId && !leadEmail) {
    console.warn(
      `[sync-smartlead-messages] skipping unmatched with no identifiers (campaign ${campaign.smartlead_campaign_id})`,
    );
    return;
  }

  const sentAt = entry.time ? new Date(entry.time).toISOString() : null;
  const { event_type, direction } = classifyEvent(entry);

  const row = {
    smartlead_message_id: messageId,
    smartlead_lead_id: lead.id || lead.lead_id || null,
    smartlead_campaign_id: campaign.smartlead_campaign_id,
    lead_email: leadEmail,
    lead_linkedin_url: lead.linkedin_url || lead.linkedin_profile || null,
    lead_first_name: lead.first_name || null,
    lead_last_name: lead.last_name || null,
    lead_company_name: lead.company_name || null,
    direction,
    from_address: normalizeEmail(entry.from || entry.from_email),
    to_addresses: entry.to ? [entry.to] : null,
    subject: entry.subject || null,
    body_html: entry.email_body || null,
    body_text: entry.body || null,
    sent_at: sentAt,
    event_type,
    sequence_number: entry.email_seq_number || entry.sequence || null,
    raw_payload: entry as unknown as Record<string, unknown>,
    reason,
    last_attempted_at: new Date().toISOString(),
  };

  // Upsert so repeated sync runs don't duplicate unmatched rows
  const { error } = await supabase.from('smartlead_unmatched_messages').upsert([row], {
    onConflict: 'smartlead_message_id,lead_email',
    ignoreDuplicates: false, // refresh last_attempted_at on each run
  });

  if (error) {
    console.error('[sync-smartlead-messages] unmatched insert failed:', error.message);
  }
}
