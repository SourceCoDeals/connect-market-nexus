/**
 * backfill-smartlead-messages
 *
 * One-shot manual-invocation function that pulls FULL historical SmartLead
 * message history for existing campaigns. Unlike `sync-smartlead-messages`, it
 * does NOT respect the `outreach_sync_state.last_synced_at` cutoff — it walks
 * every lead in every campaign and fetches every message-history entry.
 *
 * Intended to be invoked manually once after the migration lands, so the new
 * `smartlead_messages` table gets populated with historical data. After the
 * backfill completes, the forward-sync worker (`sync-smartlead-messages`)
 * takes over on a 20-min cron.
 *
 * Resumable:
 *   - Pass { campaign_id: <smartlead_campaign_id> } to backfill a single
 *     campaign
 *   - Pass { start_offset: <n> } to resume a campaign from a specific lead
 *     offset
 *   - Omit both to backfill ALL active campaigns from the beginning
 *
 * This is expensive — it iterates every lead and calls message-history per
 * lead. On a production account with thousands of leads per campaign, a full
 * backfill can take many minutes. For large accounts, prefer per-campaign
 * invocations.
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
  lead?: SmartleadLead;
}

interface MessageHistoryEntry {
  type?: string;
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
  opened?: boolean;
  clicked?: boolean;
  replied?: boolean;
  bounced?: boolean;
  unsubscribed?: boolean;
}

interface MessageHistoryResponse {
  history?: MessageHistoryEntry[];
  messages?: MessageHistoryEntry[];
  data?: MessageHistoryEntry[];
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

  // Optional filter params for resumable backfills
  let filterCampaignId: number | null = null;
  let startOffset = 0;
  try {
    const body = await req.json();
    if (body?.campaign_id) filterCampaignId = Number(body.campaign_id);
    if (body?.start_offset) startOffset = Number(body.start_offset);
  } catch {
    // No body — backfill everything
  }

  const startedAt = Date.now();
  console.log(
    `[backfill-smartlead-messages] starting${filterCampaignId ? ` campaign=${filterCampaignId}` : ''}${startOffset ? ` offset=${startOffset}` : ''}`,
  );

  let campaignQuery = supabase
    .from('smartlead_campaigns')
    .select('id, smartlead_campaign_id, name, status')
    .in('status', ['active', 'paused', 'running', 'completed']);

  if (filterCampaignId !== null) {
    campaignQuery = campaignQuery.eq('smartlead_campaign_id', filterCampaignId);
  }

  const { data: campaignsData, error: campaignsError } = await campaignQuery;
  if (campaignsError) {
    return new Response(
      JSON.stringify({ error: 'failed_to_load_campaigns', detail: campaignsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const campaigns = (campaignsData || []) as unknown as CampaignRow[];
  const perCampaign: unknown[] = [];
  let totalUpserted = 0;
  let totalUnmatched = 0;
  let totalScanned = 0;

  for (const campaign of campaigns) {
    const result = await backfillCampaign(supabase, campaign, startOffset);
    perCampaign.push(result);
    totalUpserted += result.messages_upserted;
    totalUnmatched += result.unmatched;
    totalScanned += result.leads_scanned;
    startOffset = 0; // only apply start_offset to the first campaign
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'backfill',
      campaigns_processed: campaigns.length,
      total_leads_scanned: totalScanned,
      total_messages_upserted: totalUpserted,
      total_unmatched: totalUnmatched,
      duration_ms: Date.now() - startedAt,
      per_campaign: perCampaign,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

async function backfillCampaign(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  startOffset: number,
) {
  const result = {
    campaign_id: campaign.smartlead_campaign_id,
    leads_scanned: 0,
    messages_upserted: 0,
    unmatched: 0,
    errors: 0,
    duration_ms: 0,
    last_offset_processed: startOffset,
  };
  const startedAt = Date.now();

  const PAGE_SIZE = 100;
  let offset = startOffset;
  let latestActivityAt: Date | null = null;

   
  while (true) {
    const leadsResp = await listCampaignLeads(campaign.smartlead_campaign_id, offset, PAGE_SIZE);
    if (!leadsResp.ok || !leadsResp.data) {
      console.error(
        `[backfill-smartlead-messages] list leads failed for ${campaign.smartlead_campaign_id} offset=${offset}:`,
        leadsResp.error,
      );
      result.errors++;
      break;
    }

    const rawPayload = leadsResp.data as any;
    const leads: SmartleadLead[] = Array.isArray(rawPayload)
      ? rawPayload
      : rawPayload.data || rawPayload.leads || [];

    if (leads.length === 0) break;

    for (const wrapper of leads) {
      const lead = wrapper.lead || wrapper;
      result.leads_scanned++;

      const leadId = lead.id || lead.lead_id;
      if (!leadId) continue;

      const matchResult = await resolveOutreachContact(supabase, {
        email: lead.email,
        linkedin_url: lead.linkedin_url || lead.linkedin_profile,
      });

      const historyResp = await getLeadMessageHistory(campaign.smartlead_campaign_id, leadId);
      if (!historyResp.ok || !historyResp.data) {
        result.errors++;
        continue;
      }

      const history = historyResp.data as MessageHistoryResponse;
      const rawEntries =
        (Array.isArray(history?.history) && history.history) ||
        (Array.isArray(history?.messages) && history.messages) ||
        (Array.isArray(history?.data) && history.data) ||
        [];
      const entries: MessageHistoryEntry[] = rawEntries;
      if (entries.length === 0) continue;

      if (!matchResult.matched) {
        for (const entry of entries) {
          await insertUnmatched(supabase, campaign, lead, entry, matchResult.reason);
          result.unmatched++;
        }
        continue;
      }

      for (const entry of entries) {
        const upserted = await upsertMessage(supabase, campaign, lead, entry, matchResult.anchor);
        if (upserted) result.messages_upserted++;

        const entryDate = entry.time ? new Date(entry.time) : null;
        if (entryDate && (!latestActivityAt || entryDate > latestActivityAt)) {
          latestActivityAt = entryDate;
        }
      }
    }

    result.last_offset_processed = offset + leads.length;
    if (leads.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Prime forward-sync watermark so the cron worker picks up from here.
  // Only advance if we actually found activity — otherwise leave last_synced_at
  // untouched (the forward sync will pick up normally from the previous value,
  // or from NULL on first run).
  const backfillStateUpdate: Record<string, unknown> = {
    channel: 'smartlead',
    external_campaign_id: campaign.smartlead_campaign_id,
    last_sync_attempted_at: new Date().toISOString(),
    sync_status: 'ok',
    error_message: null,
    // Don't clobber messages_synced_total if the forward sync has already
    // been running — additive instead of absolute.
    messages_synced_total: result.messages_upserted,
  };
  if (latestActivityAt) {
    backfillStateUpdate.last_synced_at = latestActivityAt.toISOString();
  }
  await supabase
    .from('outreach_sync_state')
    .upsert(backfillStateUpdate, { onConflict: 'channel,external_campaign_id' });

  result.duration_ms = Date.now() - startedAt;
  return result;
}

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
  if (entry.clicked) return { event_type: 'clicked', direction: 'outbound' };
  if (entry.opened) return { event_type: 'opened', direction: 'outbound' };
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
  if (!messageId) return false;

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
    console.error('[backfill-smartlead-messages] upsert failed:', error.message);
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

  if (!messageId && !leadEmail) {
    console.warn(
      `[backfill-smartlead-messages] skipping unmatched with no identifiers (campaign ${campaign.smartlead_campaign_id})`,
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

  await supabase
    .from('smartlead_unmatched_messages')
    .upsert([row], { onConflict: 'smartlead_message_id,lead_email', ignoreDuplicates: false });
}
