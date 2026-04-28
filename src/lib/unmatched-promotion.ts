// ============================================================================
// unmatched-promotion
// ============================================================================
// Helpers that promote a row from one of the unmatched-recovery queues
// (outlook_unmatched_emails / smartlead_unmatched_messages /
// heyreach_unmatched_messages) into its canonical message table with
// manual_entry = true.
//
// The canonical insert is best-effort: if contact_id can't be resolved we
// skip it and the caller falls back to the existing deal_activities log
// path. Each promoter returns { inserted, canonicalId, reason }.
//
// Audit finding UC #18: linking unmatched rows previously wrote ONLY to
// deal_activities, which surfaced them in the deal page feed but kept them
// invisible to buyer-/firm-scoped views (which read the canonical tables
// via unified_contact_timeline).
// ============================================================================

import { supabase, untypedFrom } from '@/integrations/supabase/client';
import { resolveContactByEmail, resolveContactByLinkedInUrl } from './activity-contact-resolution';

export interface PromotionResult {
  inserted: boolean;
  canonicalId?: string;
  reason?: string;
}

// ── Outlook → email_messages ────────────────────────────────────────────────

interface OutlookUnmatchedRow {
  id: string;
  microsoft_message_id: string;
  microsoft_conversation_id?: string | null;
  sourceco_user_id: string;
  direction: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[] | null;
  participant_emails?: string[] | null;
  subject: string | null;
  body_html?: string | null;
  body_text?: string | null;
  body_preview: string | null;
  sent_at: string;
  has_attachments?: boolean | null;
  attachment_metadata?: unknown;
}

export async function promoteOutlookToCanonical(
  row: OutlookUnmatchedRow,
  _dealId: string,
  listingId: string | null | undefined,
): Promise<PromotionResult> {
  // Resolve contact via the inbound participant address (NOT the mailbox owner).
  // For inbound rows the counterparty is from_address; for outbound it's the
  // first to_address. This is the same heuristic the Outlook sync uses.
  const counterpartyEmail = row.direction === 'inbound' ? row.from_address : row.to_addresses?.[0];
  const resolved = await resolveContactByEmail(counterpartyEmail, listingId);
  if (!resolved) {
    return { inserted: false, reason: 'No contact resolved from counterparty email' };
  }

  const { data, error } = await untypedFrom('email_messages')
    .insert({
      microsoft_message_id: row.microsoft_message_id,
      microsoft_conversation_id: row.microsoft_conversation_id ?? null,
      contact_id: resolved.contactId,
      sourceco_user_id: row.sourceco_user_id,
      direction: row.direction,
      from_address: row.from_address,
      to_addresses: row.to_addresses ?? [],
      cc_addresses: row.cc_addresses ?? [],
      subject: row.subject,
      body_html: row.body_html ?? null,
      body_text: row.body_text ?? row.body_preview ?? null,
      sent_at: row.sent_at,
      has_attachments: row.has_attachments ?? false,
      attachment_metadata: row.attachment_metadata ?? [],
      manual_entry: true,
    })
    .select('id')
    .single();

  if (error) {
    return { inserted: false, reason: error.message };
  }
  return { inserted: true, canonicalId: data?.id };
}

// ── Smartlead → smartlead_messages ──────────────────────────────────────────

interface SmartleadUnmatchedRow {
  id: string;
  smartlead_message_id: string | null;
  smartlead_lead_id: number | null;
  smartlead_campaign_id: number | null;
  lead_email: string | null;
  direction: string | null;
  from_address?: string | null;
  to_addresses?: string[] | null;
  subject: string | null;
  body_html?: string | null;
  body_text: string | null;
  sent_at: string | null;
  event_type: string | null;
  sequence_number?: number | null;
  raw_payload?: unknown;
}

export async function promoteSmartleadToCanonical(
  row: SmartleadUnmatchedRow,
  _dealId: string,
  listingId: string | null | undefined,
): Promise<PromotionResult> {
  // Smartlead's counterparty signal is lead_email or from_address.
  const counterpartyEmail = row.lead_email ?? row.from_address ?? null;
  const resolved = await resolveContactByEmail(counterpartyEmail, listingId);
  if (!resolved) {
    return { inserted: false, reason: 'No contact resolved from lead email' };
  }

  // smartlead_messages requires direction NOT NULL and event_type NOT NULL with
  // a CHECK constraint: ('sent','opened','clicked','bounced','replied','unsubscribed').
  // The unmatched row's event_type may be uppercased or freeform — coerce.
  const evt = (row.event_type ?? '').toLowerCase();
  const allowedEvents = new Set([
    'sent',
    'opened',
    'clicked',
    'bounced',
    'replied',
    'unsubscribed',
  ]);
  const safeEventType = allowedEvents.has(evt)
    ? evt
    : row.direction === 'inbound'
      ? 'replied'
      : 'sent';

  // contact_type XOR check: 'buyer' rows must have NULL listing_id; 'seller'
  // rows must have NULL remarketing_buyer_id. We use the resolved contact's
  // type and set the matching anchor.
  const contactType = resolved.contactType === 'seller' ? 'seller' : 'buyer';

  const { data, error } = await untypedFrom('smartlead_messages')
    .insert({
      smartlead_message_id: row.smartlead_message_id, // nullable post-migration
      smartlead_lead_id: row.smartlead_lead_id,
      smartlead_campaign_id: row.smartlead_campaign_id, // nullable post-migration
      contact_id: resolved.contactId,
      contact_type: contactType,
      remarketing_buyer_id: contactType === 'buyer' ? null : null, // resolver doesn't currently surface this; leave null
      listing_id: contactType === 'seller' ? listingId : null,
      direction: row.direction ?? 'inbound',
      from_address: row.from_address ?? row.lead_email ?? '',
      to_addresses: row.to_addresses ?? [],
      subject: row.subject,
      body_html: row.body_html ?? null,
      body_text: row.body_text,
      sent_at: row.sent_at ?? new Date().toISOString(),
      event_type: safeEventType,
      sequence_number: row.sequence_number,
      raw_payload: row.raw_payload ?? null,
      manual_entry: true,
    })
    .select('id')
    .single();

  if (error) {
    return { inserted: false, reason: error.message };
  }
  return { inserted: true, canonicalId: data?.id };
}

// ── HeyReach → heyreach_messages ────────────────────────────────────────────

interface HeyReachUnmatchedRow {
  id: string;
  heyreach_message_id: string | null;
  heyreach_lead_id: string | null;
  heyreach_campaign_id: number | null;
  lead_linkedin_url: string | null;
  lead_email: string | null;
  direction: string | null;
  from_linkedin_url?: string | null;
  to_linkedin_url?: string | null;
  message_type: string | null;
  subject: string | null;
  body_text: string | null;
  sent_at: string | null;
  event_type: string | null;
  raw_payload?: unknown;
}

export async function promoteHeyReachToCanonical(
  row: HeyReachUnmatchedRow,
  _dealId: string,
  listingId: string | null | undefined,
): Promise<PromotionResult> {
  // Try LinkedIn URL first (HeyReach's primary identifier), then email.
  let resolved = await resolveContactByLinkedInUrl(row.lead_linkedin_url, listingId);
  if (!resolved) {
    resolved = await resolveContactByEmail(row.lead_email, listingId);
  }
  if (!resolved) {
    return { inserted: false, reason: 'No contact resolved from LinkedIn URL or lead email' };
  }

  // heyreach_messages.event_type CHECK constraint:
  // ('connection_request_sent','connection_request_accepted','message_sent',
  //  'message_received','inmail_sent','inmail_received','lead_replied',
  //  'lead_interested','lead_not_interested','profile_viewed').
  const evt = (row.event_type ?? '').toLowerCase();
  const allowedEvents = new Set([
    'connection_request_sent',
    'connection_request_accepted',
    'message_sent',
    'message_received',
    'inmail_sent',
    'inmail_received',
    'lead_replied',
    'lead_interested',
    'lead_not_interested',
    'profile_viewed',
  ]);
  const safeEventType = allowedEvents.has(evt)
    ? evt
    : row.direction === 'inbound'
      ? 'message_received'
      : 'message_sent';

  // message_type CHECK: ('connection_request','message','inmail','profile_view').
  const mt = (row.message_type ?? '').toLowerCase();
  const allowedMessageTypes = new Set(['connection_request', 'message', 'inmail', 'profile_view']);
  const safeMessageType = allowedMessageTypes.has(mt) ? mt : 'message';

  const contactType = resolved.contactType === 'seller' ? 'seller' : 'buyer';

  const { data, error } = await untypedFrom('heyreach_messages')
    .insert({
      heyreach_message_id: row.heyreach_message_id,
      heyreach_lead_id: row.heyreach_lead_id,
      heyreach_campaign_id: row.heyreach_campaign_id, // nullable
      contact_id: resolved.contactId,
      contact_type: contactType,
      listing_id: contactType === 'seller' ? listingId : null,
      direction: row.direction ?? 'inbound',
      from_linkedin_url: row.from_linkedin_url ?? null,
      to_linkedin_url: row.to_linkedin_url ?? row.lead_linkedin_url ?? null,
      message_type: safeMessageType,
      subject: row.subject,
      body_text: row.body_text,
      sent_at: row.sent_at ?? new Date().toISOString(),
      event_type: safeEventType,
      raw_payload: row.raw_payload ?? null,
      manual_entry: true,
    })
    .select('id')
    .single();

  if (error) {
    return { inserted: false, reason: error.message };
  }
  return { inserted: true, canonicalId: data?.id };
}

// ── Optional: a thin RPC-style wrapper for log_deal_activity that adds
//    canonical promotion metadata. Kept here so the unmatched page can stay
//    declarative.
// ────────────────────────────────────────────────────────────────────────────

export async function logDealActivityWithPromotion(args: {
  dealId: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  promotion: PromotionResult;
}) {
  const { dealId, activityType, title, description, metadata, promotion } = args;
  try {
    await (supabase as any).rpc('log_deal_activity', {
      p_deal_id: dealId,
      p_activity_type: activityType,
      p_title: title,
      p_description: description,
      p_admin_id: null,
      p_metadata: {
        ...metadata,
        canonical_inserted: promotion.inserted,
        canonical_id: promotion.canonicalId ?? null,
        canonical_skip_reason: promotion.reason ?? null,
      },
    });
  } catch (e) {
    console.error('Failed to log deal activity:', e);
  }
}
