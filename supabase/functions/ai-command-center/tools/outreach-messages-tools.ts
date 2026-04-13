/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Outreach Messages Tools — AI Command Center
 *
 * Exposes queries against the SmartLead + HeyReach message tables
 * (smartlead_messages, heyreach_messages) so the AI chat can answer:
 *   - "How many times have we reached out to Sarah Chen?"
 *   - "What's our reply rate on the Q1 HVAC campaign?"
 *   - "Show me every touchpoint with Summit Partners"
 *   - "Which buyers replied but we didn't follow up?"
 *
 * Separate from the existing `outreach-tools.ts` which handles PhoneBurner /
 * data room / buyer outreach status.
 *
 * All tools are read-only and do NOT require user confirmation.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
type SupabaseClient = ReturnType<typeof createClient>;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const outreachMessagesTools: ClaudeTool[] = [
  {
    name: 'get_contact_outreach_history',
    description:
      'Return every SmartLead email and HeyReach LinkedIn touchpoint for a specific contact. Use when the user asks "what have we sent to X?", "how many times have we contacted X?", "show me the outreach history for X". Returns a chronological timeline with event_type, direction, channel, subject, body preview, and sent_at.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: {
          type: 'string',
          description:
            'UUID of the contact. If the user gives a name or email, resolve it with search_contacts first.',
        },
        limit: {
          type: 'number',
          description: 'Max events to return (default 100)',
        },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'get_contact_outreach_summary',
    description:
      'Return aggregate outreach counts for a contact — total emails sent, opens, replies, LinkedIn connects, etc. — plus first-touch and last-touch timestamps. Use for "how many times have we contacted X?" or "when did we last touch X?".',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'UUID of the contact.' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'get_firm_outreach_summary',
    description:
      'Return aggregate outreach rollup for a PE firm or buyer org — all touchpoints across all contacts at that firm. Use when the user asks "what have we done with Summit Partners?", "how many contacts at X have we reached?", "when did we last touch anyone at X?".',
    input_schema: {
      type: 'object',
      properties: {
        remarketing_buyer_id: {
          type: 'string',
          description:
            'UUID of the remarketing_buyer (firm) record. If given a firm name, resolve with search_buyers first.',
        },
      },
      required: ['remarketing_buyer_id'],
    },
  },
  {
    name: 'get_campaign_outreach_stats',
    description:
      'Return per-campaign outreach performance metrics: sent, opened, replied, reply rate. Supports SmartLead and HeyReach campaigns. Use for "how is the Q1 HVAC campaign performing?", "what is our reply rate on X?", "compare campaigns". When called without a campaign_id, returns the top 20 campaigns by reply rate.',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['smartlead', 'heyreach', 'both'],
          description: 'Which channel to include (default "both")',
        },
        external_campaign_id: {
          type: 'number',
          description:
            'Optional: specific external campaign ID. If omitted, returns the top 20 campaigns by reply rate.',
        },
        days: {
          type: 'number',
          description: 'Restrict to activity in the last N days (default: all time)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_dropped_outreach_threads',
    description:
      'Find contacts who replied to our outreach but we never followed up. A dropped thread is when their last inbound message is more recent than our last outbound message to them. Use for "who are we ignoring?", "find dropped replies", "who needs a follow-up?".',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['smartlead', 'heyreach', 'both'],
          description: 'Which channel to check (default "both")',
        },
        days: {
          type: 'number',
          description: 'Only consider replies in the last N days (default 14)',
        },
        limit: {
          type: 'number',
          description: 'Max threads to return (default 25)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_stale_outreach_contacts',
    description:
      'Find contacts who have not been touched by SmartLead or HeyReach in the last N days (default 21). Use for re-engagement campaigns: "which buyers are cold?", "who needs a ping?". Optionally filter to a specific firm.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Staleness threshold in days (default 21)',
        },
        contact_type: {
          type: 'string',
          enum: ['buyer', 'seller'],
          description: 'Filter to buyers or sellers (default: buyers only)',
        },
        remarketing_buyer_id: {
          type: 'string',
          description: 'Optional: only show contacts at a specific firm',
        },
        limit: {
          type: 'number',
          description: 'Max contacts to return (default 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_unmatched_outreach_queue',
    description:
      'Return pending records in the outreach unmatched queue — outreach events we could not match to an existing contact. Use for data hygiene audits and "why are we missing outreach for X?" investigations.',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['smartlead', 'heyreach', 'both'],
        },
        reason: {
          type: 'string',
          enum: ['no_match', 'missing_anchor', 'unsupported_contact_type', 'missing_identifiers'],
          description: 'Filter to a specific reason code',
        },
        limit: {
          type: 'number',
          description: 'Default 50',
        },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeOutreachMessagesTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'get_contact_outreach_history':
        return await getContactOutreachHistory(supabase, args);
      case 'get_contact_outreach_summary':
        return await getContactOutreachSummary(supabase, args);
      case 'get_firm_outreach_summary':
        return await getFirmOutreachSummary(supabase, args);
      case 'get_campaign_outreach_stats':
        return await getCampaignOutreachStats(supabase, args);
      case 'get_dropped_outreach_threads':
        return await getDroppedOutreachThreads(supabase, args);
      case 'get_stale_outreach_contacts':
        return await getStaleOutreachContacts(supabase, args);
      case 'get_unmatched_outreach_queue':
        return await getUnmatchedOutreachQueue(supabase, args);
      default:
        return { error: `Unknown outreach-messages tool: ${toolName}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function getContactOutreachHistory(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const contactId = args.contact_id as string;
  const limit = (args.limit as number) || 100;

  if (!contactId) return { error: 'contact_id is required' };

  const [smartleadResult, heyreachResult] = await Promise.all([
    (supabase as any)
      .from('smartlead_messages')
      .select(
        'smartlead_message_id, smartlead_campaign_id, event_type, direction, from_address, to_addresses, subject, body_text, sent_at, sequence_number',
      )
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: false })
      .limit(limit),
    (supabase as any)
      .from('heyreach_messages')
      .select(
        'heyreach_message_id, heyreach_campaign_id, event_type, direction, from_linkedin_url, to_linkedin_url, message_type, subject, body_text, sent_at',
      )
      .eq('contact_id', contactId)
      .order('sent_at', { ascending: false })
      .limit(limit),
  ]);

  if (smartleadResult.error) return { error: smartleadResult.error.message };
  if (heyreachResult.error) return { error: heyreachResult.error.message };

  const smartlead = (smartleadResult.data || []).map((r: any) => ({
    channel: 'smartlead',
    event_type: r.event_type,
    direction: r.direction,
    subject: r.subject,
    preview: r.body_text ? r.body_text.slice(0, 240) : null,
    from: r.from_address,
    to: r.to_addresses,
    sequence_number: r.sequence_number,
    campaign_id: r.smartlead_campaign_id,
    sent_at: r.sent_at,
  }));
  const heyreach = (heyreachResult.data || []).map((r: any) => ({
    channel: 'heyreach',
    event_type: r.event_type,
    direction: r.direction,
    message_type: r.message_type,
    subject: r.subject,
    preview: r.body_text ? r.body_text.slice(0, 240) : null,
    from: r.from_linkedin_url,
    to: r.to_linkedin_url,
    campaign_id: r.heyreach_campaign_id,
    sent_at: r.sent_at,
  }));

  const merged = [...smartlead, ...heyreach]
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    .slice(0, limit);

  return {
    data: {
      contact_id: contactId,
      total_events: merged.length,
      smartlead_events: smartlead.length,
      heyreach_events: heyreach.length,
      timeline: merged,
    },
  };
}

async function getContactOutreachSummary(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const contactId = args.contact_id as string;
  if (!contactId) return { error: 'contact_id is required' };

  const { data, error } = await (supabase as any)
    .from('v_contact_outreach_summary')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data)
    return { data: { contact_id: contactId, message: 'No contact found or no outreach yet.' } };

  return { data };
}

async function getFirmOutreachSummary(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const firmId = args.remarketing_buyer_id as string;
  if (!firmId) return { error: 'remarketing_buyer_id is required' };

  const { data, error } = await (supabase as any)
    .from('v_firm_outreach_summary')
    .select('*')
    .eq('remarketing_buyer_id', firmId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      data: {
        remarketing_buyer_id: firmId,
        message: 'No outreach activity found for this firm.',
      },
    };
  }
  return { data };
}

async function getCampaignOutreachStats(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const channel = (args.channel as string) || 'both';
  const externalCampaignId = args.external_campaign_id as number | undefined;
  const days = args.days as number | undefined;

  let query = (supabase as any).from('v_campaign_outreach_stats').select('*');

  if (channel === 'smartlead' || channel === 'heyreach') {
    query = query.eq('channel', channel);
  }
  if (externalCampaignId) {
    query = query.eq('external_campaign_id', externalCampaignId);
  }
  if (days && days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('last_activity_at', since);
  }

  query = query.order('reply_rate_pct', { ascending: false, nullsFirst: false }).limit(20);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    data: {
      channel,
      days_window: days || 'all_time',
      campaign_count: (data || []).length,
      campaigns: data || [],
    },
  };
}

async function getDroppedOutreachThreads(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const channel = (args.channel as string) || 'both';
  const days = (args.days as number) || 14;
  const limit = (args.limit as number) || 25;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pull recent inbound messages from each relevant channel
  type InboundRow = {
    contact_id: string;
    sent_at: string;
    channel: string;
    subject: string | null;
  };
  const inboundRows: InboundRow[] = [];

  if (channel === 'smartlead' || channel === 'both') {
    const { data, error } = await (supabase as any)
      .from('smartlead_messages')
      .select('contact_id, sent_at, subject')
      .eq('direction', 'inbound')
      .eq('event_type', 'replied')
      .gte('sent_at', since);
    if (error) return { error: error.message };
    for (const row of data || []) {
      inboundRows.push({
        contact_id: row.contact_id,
        sent_at: row.sent_at,
        channel: 'smartlead',
        subject: row.subject,
      });
    }
  }

  if (channel === 'heyreach' || channel === 'both') {
    const { data, error } = await (supabase as any)
      .from('heyreach_messages')
      .select('contact_id, sent_at, subject')
      .eq('direction', 'inbound')
      .in('event_type', ['lead_replied', 'message_received', 'inmail_received'])
      .gte('sent_at', since);
    if (error) return { error: error.message };
    for (const row of data || []) {
      inboundRows.push({
        contact_id: row.contact_id,
        sent_at: row.sent_at,
        channel: 'heyreach',
        subject: row.subject,
      });
    }
  }

  // Keep latest inbound per contact
  const latestInbound = new Map<string, InboundRow>();
  for (const row of inboundRows) {
    const existing = latestInbound.get(row.contact_id);
    if (!existing || new Date(row.sent_at) > new Date(existing.sent_at)) {
      latestInbound.set(row.contact_id, row);
    }
  }

  if (latestInbound.size === 0) {
    return { data: { dropped_threads: [], message: `No replies in the last ${days} days.` } };
  }

  const contactIds = Array.from(latestInbound.keys());

  const [slOut, hrOut, contactsResult] = await Promise.all([
    (supabase as any)
      .from('smartlead_messages')
      .select('contact_id, sent_at')
      .in('contact_id', contactIds)
      .eq('direction', 'outbound'),
    (supabase as any)
      .from('heyreach_messages')
      .select('contact_id, sent_at')
      .in('contact_id', contactIds)
      .eq('direction', 'outbound'),
    (supabase as any)
      .from('contacts')
      .select('id, first_name, last_name, email, remarketing_buyer_id')
      .in('id', contactIds),
  ]);

  if (slOut.error) return { error: slOut.error.message };
  if (hrOut.error) return { error: hrOut.error.message };
  if (contactsResult.error) return { error: contactsResult.error.message };

  const latestOutbound = new Map<string, string>();
  for (const row of [...(slOut.data || []), ...(hrOut.data || [])]) {
    const existing = latestOutbound.get(row.contact_id);
    if (!existing || new Date(row.sent_at) > new Date(existing)) {
      latestOutbound.set(row.contact_id, row.sent_at);
    }
  }

  const contactMap = new Map<string, any>();
  for (const c of contactsResult.data || []) contactMap.set(c.id, c);

  const dropped: any[] = [];
  for (const [contactId, inbound] of latestInbound.entries()) {
    const lastOut = latestOutbound.get(contactId);
    if (!lastOut || new Date(lastOut) < new Date(inbound.sent_at)) {
      const contact = contactMap.get(contactId);
      if (!contact) continue;
      const hoursSince = Math.round(
        (Date.now() - new Date(inbound.sent_at).getTime()) / (60 * 60 * 1000),
      );
      dropped.push({
        contact_id: contactId,
        contact_name:
          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email,
        email: contact.email,
        remarketing_buyer_id: contact.remarketing_buyer_id,
        reply_channel: inbound.channel,
        reply_subject: inbound.subject,
        reply_at: inbound.sent_at,
        last_outbound_at: lastOut || null,
        hours_since_reply: hoursSince,
      });
    }
  }

  dropped.sort((a, b) => new Date(a.reply_at).getTime() - new Date(b.reply_at).getTime());

  return {
    data: {
      days_window: days,
      channel,
      dropped_count: dropped.length,
      dropped_threads: dropped.slice(0, limit),
    },
  };
}

async function getStaleOutreachContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const days = (args.days as number) || 21;
  const contactType = (args.contact_type as string) || 'buyer';
  const firmId = args.remarketing_buyer_id as string | undefined;
  const limit = (args.limit as number) || 50;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = (supabase as any)
    .from('v_contact_outreach_summary')
    .select(
      'contact_id, first_name, last_name, email, contact_type, remarketing_buyer_id, last_touch_at, total_outbound_events, total_replies',
    )
    .eq('contact_type', contactType)
    .eq('archived', false);

  if (firmId) {
    query = query.eq('remarketing_buyer_id', firmId);
  }

  // Two flavors of stale: never touched, OR touched before cutoff
  query = query.or(`last_touch_at.is.null,last_touch_at.lt.${cutoff}`);
  query = query.order('last_touch_at', { ascending: true, nullsFirst: true }).limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    data: {
      days_threshold: days,
      contact_type: contactType,
      stale_count: (data || []).length,
      contacts: data || [],
    },
  };
}

async function getUnmatchedOutreachQueue(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const channel = (args.channel as string) || 'both';
  const reason = args.reason as string | undefined;
  const limit = (args.limit as number) || 50;

  const results: any[] = [];

  if (channel === 'smartlead' || channel === 'both') {
    let q = (supabase as any)
      .from('smartlead_unmatched_messages')
      .select(
        'smartlead_message_id, smartlead_campaign_id, lead_email, lead_linkedin_url, lead_first_name, lead_last_name, lead_company_name, reason, event_type, sent_at, created_at',
      )
      .is('matched_at', null);
    if (reason) q = q.eq('reason', reason);
    q = q.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await q;
    if (error) return { error: error.message };
    for (const row of data || []) results.push({ channel: 'smartlead', ...row });
  }

  if (channel === 'heyreach' || channel === 'both') {
    let q = (supabase as any)
      .from('heyreach_unmatched_messages')
      .select(
        'heyreach_message_id, heyreach_campaign_id, lead_email, lead_linkedin_url, lead_first_name, lead_last_name, lead_company_name, reason, event_type, sent_at, created_at',
      )
      .is('matched_at', null);
    if (reason) q = q.eq('reason', reason);
    q = q.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await q;
    if (error) return { error: error.message };
    for (const row of data || []) results.push({ channel: 'heyreach', ...row });
  }

  return {
    data: {
      channel,
      reason_filter: reason || 'all',
      unmatched_count: results.length,
      rows: results,
    },
  };
}
