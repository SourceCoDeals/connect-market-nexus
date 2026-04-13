/**
 * backfill-heyreach-messages
 *
 * One-shot manual-invocation function that pulls FULL historical HeyReach
 * conversations and messages for existing campaigns. Ignores the
 * `outreach_sync_state.last_synced_at` cutoff — walks every conversation
 * in every active campaign.
 *
 * Invoke once after the migration lands to populate `heyreach_messages` with
 * historical data. After backfill completes, `sync-heyreach-messages` (the
 * 20-min cron) takes over for forward activity.
 *
 * Resumable:
 *   - { campaign_id: <heyreach_campaign_id> } → single campaign
 *   - { start_offset: <n> } → resume from a specific conversation offset
 *   - No body → backfill all active campaigns from scratch
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
  messages?: HeyReachMessage[];
}

interface HeyReachMessage {
  id?: string;
  messageId?: string;
  message_id?: string;
  type?: string;
  direction?: string;
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
}

interface ConversationsResponse {
  items?: HeyReachConversation[];
  conversations?: HeyReachConversation[];
  data?: HeyReachConversation[];
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

  let filterCampaignId: number | null = null;
  let startOffset = 0;
  try {
    const body = await req.json();
    if (body?.campaign_id) filterCampaignId = Number(body.campaign_id);
    if (body?.start_offset) startOffset = Number(body.start_offset);
  } catch {
    // No body — full backfill
  }

  const startedAt = Date.now();

  let campaignQuery = supabase
    .from('heyreach_campaigns')
    .select('id, heyreach_campaign_id, name, status')
    .in('status', ['active', 'paused', 'running', 'completed']);

  if (filterCampaignId !== null) {
    campaignQuery = campaignQuery.eq('heyreach_campaign_id', filterCampaignId);
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
    totalScanned += result.conversations_scanned;
    startOffset = 0;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'backfill',
      campaigns_processed: campaigns.length,
      total_conversations_scanned: totalScanned,
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
    campaign_id: campaign.heyreach_campaign_id,
    conversations_scanned: 0,
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
    const resp = await getConversations({
      campaignIds: [campaign.heyreach_campaign_id],
      offset,
      limit: PAGE_SIZE,
    });

    if (!resp.ok || !resp.data) {
      result.errors++;
      break;
    }

    const rawPayload = resp.data as ConversationsResponse;
    const conversations = rawPayload.items || rawPayload.conversations || rawPayload.data || [];

    if (conversations.length === 0) break;

    for (const conv of conversations) {
      result.conversations_scanned++;

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

        const msgDate = msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt;
        if (msgDate) {
          const d = new Date(msgDate as string);
          if (!latestActivityAt || d > latestActivityAt) latestActivityAt = d;
        }
      }
    }

    result.last_offset_processed = offset + conversations.length;
    if (conversations.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Only advance watermark if we observed activity. See SmartLead backfill for details.
  const backfillStateUpdate: Record<string, unknown> = {
    channel: 'heyreach',
    external_campaign_id: campaign.heyreach_campaign_id,
    last_sync_attempted_at: new Date().toISOString(),
    sync_status: 'ok',
    error_message: null,
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

function classifyMessage(msg: HeyReachMessage): {
  event_type: string;
  message_type: 'connection_request' | 'message' | 'inmail' | 'profile_view';
  direction: 'inbound' | 'outbound';
} {
  const type = (msg.type || '').toUpperCase();
  const rawDirection = (msg.direction || '').toLowerCase();
  const eventTypeRaw = (msg.eventType || msg.event_type || '').toUpperCase();

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
  if (!messageId) return false;

  const sentRaw = msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt;
  const sentAt = sentRaw ? new Date(sentRaw as string).toISOString() : new Date().toISOString();
  const { event_type, message_type, direction } = classifyMessage(msg);
  const body = msg.body || msg.text || msg.message || msg.content || null;

  const row = {
    heyreach_message_id: messageId,
    heyreach_lead_id: (conv.id || conv.conversationId) ?? null,
    heyreach_campaign_id: campaign.heyreach_campaign_id,
    contact_id: anchor.contact_id,
    contact_type: anchor.contact_type,
    remarketing_buyer_id: anchor.remarketing_buyer_id,
    listing_id: anchor.listing_id,
    direction,
    from_linkedin_url:
      normalizeLinkedInUrl(msg.senderLinkedInUrl || msg.sender_linkedin_url) || null,
    to_linkedin_url:
      normalizeLinkedInUrl(msg.recipientLinkedInUrl || msg.recipient_linkedin_url) || null,
    message_type,
    subject: msg.subject || null,
    body_text: body,
    sent_at: sentAt,
    synced_at: new Date().toISOString(),
    event_type,
    raw_payload: msg as unknown as Record<string, unknown>,
  };

  const { error } = await supabase.from('heyreach_messages').upsert([row], {
    onConflict: 'heyreach_message_id,contact_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[backfill-heyreach-messages] upsert failed:', error.message);
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

  if (!messageId && !leadLinkedIn) {
    console.warn(
      `[backfill-heyreach-messages] skipping unmatched with no identifiers (campaign ${campaign.heyreach_campaign_id})`,
    );
    return;
  }

  const sentRaw = msg.sentAt || msg.sent_at || msg.timestamp || msg.createdAt;
  const { event_type, message_type, direction } = classifyMessage(msg);

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
    from_linkedin_url: msg.senderLinkedInUrl || msg.sender_linkedin_url || null,
    to_linkedin_url: msg.recipientLinkedInUrl || msg.recipient_linkedin_url || null,
    message_type,
    subject: msg.subject || null,
    body_text: msg.body || msg.text || msg.message || msg.content || null,
    sent_at: sentRaw ? new Date(sentRaw as string).toISOString() : null,
    event_type,
    raw_payload: msg as unknown as Record<string, unknown>,
    reason,
    last_attempted_at: new Date().toISOString(),
  };

  await supabase
    .from('heyreach_unmatched_messages')
    .upsert([row], {
      onConflict: 'heyreach_message_id,lead_linkedin_url',
      ignoreDuplicates: false,
    });
}
