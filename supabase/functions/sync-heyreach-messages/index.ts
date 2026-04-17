/**
 * sync-heyreach-messages
 *
 * Forward-sync worker that pulls new HeyReach LinkedIn activity into
 * `heyreach_messages` and `heyreach_unmatched_messages`. Runs every 20 min
 * via pg_cron, staggered 10 min from the SmartLead worker.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET or admin JWT)
 *   2. Fetch active campaigns from local `heyreach_campaigns` table
 *   3. For each campaign:
 *      a. Read/create outreach_sync_state row
 *      b. Call HeyReach `/inbox/GetConversationsV2` scoped to campaign, paginated
 *      c. Filter to conversations with activity since last sync
 *      d. For each message inside each conversation:
 *         - Resolve contact by LinkedIn URL (primary) / email (fallback)
 *         - Upsert to heyreach_messages, or park in unmatched queue
 *      e. Update outreach_sync_state with high-water mark
 *   4. Return summary
 *
 * Dedup via UNIQUE (heyreach_message_id, contact_id). Matching uses the
 * shared `resolveOutreachContact` helper which normalizes URLs and respects
 * the buyer/seller contact_type distinction.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getConversations } from '../_shared/heyreach-client.ts';
import {
  isAuthorizedCronRequest,
  resolveOutreachContact,
  normalizeLinkedInUrl,
  type OutreachAnchor,
  type UnmatchedReason,
} from '../_shared/outreach-match.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

interface CampaignRow {
  id: string;
  heyreach_campaign_id: number;
  name: string;
  status: string;
}

interface HeyReachConversation {
  id?: string;
  conversationId?: string;
  campaignId?: number;
  leadLinkedInUrl?: string;
  lead_linkedin_url?: string;
  leadProfileUrl?: string;
  linkedInUrl?: string;
  leadEmail?: string;
  email?: string;
  leadFirstName?: string;
  first_name?: string;
  leadLastName?: string;
  last_name?: string;
  companyName?: string;
  company_name?: string;
  lastMessageAt?: string;
  last_message_at?: string;
  updatedAt?: string;
  messages?: HeyReachMessage[];
  [key: string]: unknown;
}

interface HeyReachMessage {
  id?: string;
  messageId?: string;
  message_id?: string;
  type?: string; // CONNECTION_REQUEST / MESSAGE / INMAIL
  direction?: string; // sent / received
  senderLinkedInUrl?: string;
  sender_linkedin_url?: string;
  recipientLinkedInUrl?: string;
  recipient_linkedin_url?: string;
  subject?: string;
  body?: string;
  text?: string;
  message?: string;
  content?: string;
  sentAt?: string;
  sent_at?: string;
  timestamp?: string;
  createdAt?: string;
  eventType?: string;
  event_type?: string;
  [key: string]: unknown;
}

interface ConversationsResponse {
  items?: HeyReachConversation[];
  conversations?: HeyReachConversation[];
  data?: HeyReachConversation[];
  total?: number;
}

type CampaignSyncResult = {
  campaign_id: number;
  conversations_scanned: number;
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

  let filterCampaignId: number | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.campaign_id === 'number') {
      filterCampaignId = body.campaign_id;
    }
  } catch {
    // No body
  }

  const startedAt = Date.now();
  console.log(
    `[sync-heyreach-messages] starting${filterCampaignId ? ` (single campaign ${filterCampaignId})` : ''}`,
  );

  let campaignQuery = supabase
    .from('heyreach_campaigns')
    .select('id, heyreach_campaign_id, name, status')
    .in('status', ['active', 'paused', 'running']);

  if (filterCampaignId !== null) {
    campaignQuery = campaignQuery.eq('heyreach_campaign_id', filterCampaignId);
  }

  const { data: campaignsData, error: campaignsError } = await campaignQuery;
  if (campaignsError) {
    console.error('[sync-heyreach-messages] Failed to load campaigns:', campaignsError.message);
    return new Response(
      JSON.stringify({ error: 'failed_to_load_campaigns', detail: campaignsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const campaigns = (campaignsData || []) as unknown as CampaignRow[];
  console.log(`[sync-heyreach-messages] ${campaigns.length} campaigns to sync`);

  const results: CampaignSyncResult[] = [];

  for (const campaign of campaigns) {
    try {
      const result = await syncCampaign(supabase, campaign);
      results.push(result);
    } catch (err) {
      console.error(
        `[sync-heyreach-messages] Campaign ${campaign.heyreach_campaign_id} crashed:`,
        err instanceof Error ? err.message : err,
      );
      await supabase.from('outreach_sync_state').upsert(
        {
          channel: 'heyreach',
          external_campaign_id: campaign.heyreach_campaign_id,
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
    total_conversations_scanned: results.reduce((a, r) => a + r.conversations_scanned, 0),
    total_messages_upserted: results.reduce((a, r) => a + r.messages_upserted, 0),
    total_unmatched: results.reduce((a, r) => a + r.unmatched, 0),
    total_errors: results.reduce((a, r) => a + r.errors, 0),
    duration_ms: totalDuration,
    per_campaign: results,
  };

  console.log(
    `[sync-heyreach-messages] done in ${totalDuration}ms — ${summary.total_messages_upserted} new, ${summary.total_unmatched} unmatched`,
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
    campaign_id: campaign.heyreach_campaign_id,
    conversations_scanned: 0,
    messages_upserted: 0,
    unmatched: 0,
    errors: 0,
    duration_ms: 0,
  };
  const startedAt = Date.now();

  const { data: stateRow } = await supabase
    .from('outreach_sync_state')
    .select('last_synced_at, messages_synced_total')
    .eq('channel', 'heyreach')
    .eq('external_campaign_id', campaign.heyreach_campaign_id)
    .maybeSingle();

  const lastSyncedAt = (stateRow as { last_synced_at: string | null } | null)?.last_synced_at
    ? new Date((stateRow as { last_synced_at: string }).last_synced_at)
    : null;

  await supabase.from('outreach_sync_state').upsert(
    {
      channel: 'heyreach',
      external_campaign_id: campaign.heyreach_campaign_id,
      last_sync_attempted_at: new Date().toISOString(),
      sync_status: 'running',
      error_message: null,
    },
    { onConflict: 'channel,external_campaign_id' },
  );

  // Paginate through conversations
  const PAGE_SIZE = 100;
  let offset = 0;
  let latestActivityAt = lastSyncedAt;

  while (true) {
    const resp = await getConversations({
      campaignIds: [campaign.heyreach_campaign_id],
      offset,
      limit: PAGE_SIZE,
    });

    if (!resp.ok || !resp.data) {
      console.error(
        `[sync-heyreach-messages] GetConversationsV2 failed for ${campaign.heyreach_campaign_id}:`,
        resp.error,
      );
      result.errors++;
      break;
    }

    const rawPayload = resp.data as ConversationsResponse;
    const conversations = rawPayload.items || rawPayload.conversations || rawPayload.data || [];

    if (conversations.length === 0) break;

    for (const conv of conversations) {
      result.conversations_scanned++;

      // Filter by last-activity cutoff to avoid re-processing stale conversations.
      // Strict < so conversations at the exact watermark second are re-processed;
      // DB dedup catches true duplicates.
      const lastActivity = conv.lastMessageAt || conv.last_message_at || conv.updatedAt;
      if (lastActivity && lastSyncedAt) {
        const activityDate = new Date(lastActivity);
        if (activityDate < lastSyncedAt) continue;
        if (!latestActivityAt || activityDate > latestActivityAt) {
          latestActivityAt = activityDate;
        }
      } else if (lastActivity) {
        const activityDate = new Date(lastActivity);
        if (!latestActivityAt || activityDate > latestActivityAt) {
          latestActivityAt = activityDate;
        }
      }

      // Resolve contact once per conversation
      const leadLinkedIn =
        conv.leadLinkedInUrl || conv.lead_linkedin_url || conv.leadProfileUrl || conv.linkedInUrl;
      const leadEmail = conv.leadEmail || conv.email;

      const matchResult = await resolveOutreachContact(supabase, {
        email: leadEmail,
        linkedin_url: leadLinkedIn,
      });

      const messages = conv.messages || [];
      if (messages.length === 0) continue;

      if (!matchResult.matched) {
        for (const msg of messages) {
          await insertUnmatched(supabase, campaign, conv, msg, matchResult.reason);
          result.unmatched++;
        }
        continue;
      }

      for (const msg of messages) {
        const upserted = await upsertMessage(supabase, campaign, conv, msg, matchResult.anchor);
        if (upserted) result.messages_upserted++;
      }
    }

    if (conversations.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // See sync-smartlead-messages for the watermark semantics. In short:
  // advance last_synced_at on any successful completion — to the activity
  // high-water mark if we saw activity, or to (sync_start - 5min) on first
  // successful run with zero activity, so monitoring can distinguish "never
  // ran" from "ran and found nothing".
  const bufferMs = 5 * 60 * 1000;
  const completionWatermark = new Date(startedAt - bufferMs);
  let newWatermark: Date | null = null;
  if (latestActivityAt && (!lastSyncedAt || latestActivityAt > lastSyncedAt)) {
    newWatermark = latestActivityAt;
  } else if (!lastSyncedAt) {
    newWatermark = completionWatermark;
  }

  const syncStateUpdate: Record<string, unknown> = {
    channel: 'heyreach',
    external_campaign_id: campaign.heyreach_campaign_id,
    last_sync_attempted_at: new Date().toISOString(),
    sync_status: 'ok',
    error_message: null,
    messages_synced_total:
      ((stateRow as { messages_synced_total?: number } | null)?.messages_synced_total || 0) +
      result.messages_upserted,
  };
  if (newWatermark) {
    syncStateUpdate.last_synced_at = newWatermark.toISOString();
  }
  await supabase
    .from('outreach_sync_state')
    .upsert(syncStateUpdate, { onConflict: 'channel,external_campaign_id' });

  result.duration_ms = Date.now() - startedAt;
  return result;
}

/** Map HeyReach message type + direction → (event_type, message_type, direction). */
function classifyMessage(msg: HeyReachMessage): {
  event_type: string;
  message_type: 'connection_request' | 'message' | 'inmail' | 'profile_view';
  direction: 'inbound' | 'outbound';
} {
  const type = (msg.type || '').toUpperCase();
  const rawDirection = (msg.direction || '').toLowerCase();
  const eventTypeRaw = (msg.eventType || msg.event_type || '').toUpperCase();

  // Use the webhook's event vocabulary when present
  if (eventTypeRaw) {
    const map: Record<
      string,
      {
        event_type: string;
        message_type: 'connection_request' | 'message' | 'inmail' | 'profile_view';
        direction: 'inbound' | 'outbound';
      }
    > = {
      CONNECTION_REQUEST_SENT: {
        event_type: 'connection_request_sent',
        message_type: 'connection_request',
        direction: 'outbound',
      },
      CONNECTION_REQUEST_ACCEPTED: {
        event_type: 'connection_request_accepted',
        message_type: 'connection_request',
        direction: 'inbound',
      },
      MESSAGE_SENT: { event_type: 'message_sent', message_type: 'message', direction: 'outbound' },
      MESSAGE_RECEIVED: {
        event_type: 'message_received',
        message_type: 'message',
        direction: 'inbound',
      },
      INMAIL_SENT: { event_type: 'inmail_sent', message_type: 'inmail', direction: 'outbound' },
      INMAIL_RECEIVED: {
        event_type: 'inmail_received',
        message_type: 'inmail',
        direction: 'inbound',
      },
      LEAD_REPLIED: { event_type: 'lead_replied', message_type: 'message', direction: 'inbound' },
      LEAD_INTERESTED: {
        event_type: 'lead_interested',
        message_type: 'message',
        direction: 'inbound',
      },
      LEAD_NOT_INTERESTED: {
        event_type: 'lead_not_interested',
        message_type: 'message',
        direction: 'inbound',
      },
      PROFILE_VIEWED: {
        event_type: 'profile_viewed',
        message_type: 'profile_view',
        direction: 'outbound',
      },
    };
    const mapped = map[eventTypeRaw];
    if (mapped) return mapped;
  }

  // Fallback: infer from type + direction
  const isInbound = rawDirection === 'received' || rawDirection === 'inbound';
  const direction: 'inbound' | 'outbound' = isInbound ? 'inbound' : 'outbound';

  if (type.includes('CONNECTION')) {
    return {
      event_type: isInbound ? 'connection_request_accepted' : 'connection_request_sent',
      message_type: 'connection_request',
      direction,
    };
  }
  if (type.includes('INMAIL')) {
    return {
      event_type: isInbound ? 'inmail_received' : 'inmail_sent',
      message_type: 'inmail',
      direction,
    };
  }
  if (type.includes('PROFILE_VIEW')) {
    return { event_type: 'profile_viewed', message_type: 'profile_view', direction };
  }
  // Default: treat as a message
  return {
    event_type: isInbound ? 'message_received' : 'message_sent',
    message_type: 'message',
    direction,
  };
}

async function upsertMessage(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  conv: HeyReachConversation,
  msg: HeyReachMessage,
  anchor: OutreachAnchor,
): Promise<boolean> {
  const messageId = msg.id || msg.messageId || msg.message_id;
  if (!messageId) {
    console.warn('[sync-heyreach-messages] skipping message with no id');
    return false;
  }

  const sentAt =
    msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt
      ? new Date(
          (msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt) as string,
        ).toISOString()
      : new Date().toISOString();

  const { event_type, message_type, direction } = classifyMessage(msg);
  const body = msg.body || msg.text || msg.message || msg.content || null;
  const fromUrl = normalizeLinkedInUrl(msg.senderLinkedInUrl || msg.sender_linkedin_url);
  const toUrl = normalizeLinkedInUrl(msg.recipientLinkedInUrl || msg.recipient_linkedin_url);
  const leadUrl = normalizeLinkedInUrl(
    conv.leadLinkedInUrl || conv.lead_linkedin_url || conv.leadProfileUrl || conv.linkedInUrl,
  );

  // Production schema aligns heyreach_messages with smartlead_messages:
  // LinkedIn URLs live in from_address / to_addresses (treated as "addresses"),
  // the lead's own URL in linkedin_url, and message_type is recovered from
  // event_type rather than persisted. We keep message_type in raw_payload for
  // forensics so classification output isn't lost.
  const row = {
    heyreach_message_id: messageId,
    heyreach_lead_id: (conv.id || conv.conversationId) ?? null,
    heyreach_campaign_id: campaign.heyreach_campaign_id,
    contact_id: anchor.contact_id,
    contact_type: anchor.contact_type,
    remarketing_buyer_id: anchor.remarketing_buyer_id,
    listing_id: anchor.listing_id,
    direction,
    from_address: fromUrl,
    to_addresses: toUrl ? [toUrl] : [],
    linkedin_url: leadUrl,
    subject: msg.subject || null,
    body_text: body,
    sent_at: sentAt,
    synced_at: new Date().toISOString(),
    event_type,
    raw_payload: { ...(msg as unknown as Record<string, unknown>), message_type },
  };

  const { error } = await supabase.from('heyreach_messages').upsert([row], {
    onConflict: 'heyreach_message_id,contact_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[sync-heyreach-messages] upsert failed:', error.message);
    return false;
  }
  return true;
}

async function insertUnmatched(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  conv: HeyReachConversation,
  msg: HeyReachMessage,
  reason: UnmatchedReason,
): Promise<void> {
  const messageId = msg.id || msg.messageId || msg.message_id || null;
  const leadLinkedIn =
    conv.leadLinkedInUrl ||
    conv.lead_linkedin_url ||
    conv.leadProfileUrl ||
    conv.linkedInUrl ||
    null;

  // Guard: must have at least one identifier
  if (!messageId && !leadLinkedIn) {
    console.warn(
      `[sync-heyreach-messages] skipping unmatched with no identifiers (campaign ${campaign.heyreach_campaign_id})`,
    );
    return;
  }

  const sentAt = msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt;
  const { event_type, message_type, direction } = classifyMessage(msg);
  const fromUrl = normalizeLinkedInUrl(msg.senderLinkedInUrl || msg.sender_linkedin_url);
  const toUrl = normalizeLinkedInUrl(msg.recipientLinkedInUrl || msg.recipient_linkedin_url);

  // Prod schema for heyreach_unmatched_messages uses from_address / to_addresses
  // (same shape as smartlead_unmatched). message_type is preserved in raw_payload.
  const row = {
    heyreach_message_id: messageId,
    heyreach_lead_id: conv.id || conv.conversationId || null,
    heyreach_campaign_id: campaign.heyreach_campaign_id,
    lead_linkedin_url: leadLinkedIn,
    lead_email: conv.leadEmail || conv.email || null,
    lead_first_name: conv.leadFirstName || conv.first_name || null,
    lead_last_name: conv.leadLastName || conv.last_name || null,
    lead_company_name: conv.companyName || conv.company_name || null,
    direction,
    from_address: fromUrl,
    to_addresses: toUrl ? [toUrl] : [],
    subject: msg.subject || null,
    body_text: msg.body || msg.text || msg.message || msg.content || null,
    sent_at: sentAt ? new Date(sentAt as string).toISOString() : null,
    event_type,
    raw_payload: { ...(msg as unknown as Record<string, unknown>), message_type },
    reason,
    last_attempted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('heyreach_unmatched_messages').upsert([row], {
    onConflict: 'heyreach_message_id,lead_linkedin_url',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('[sync-heyreach-messages] unmatched insert failed:', error.message);
  }
}
