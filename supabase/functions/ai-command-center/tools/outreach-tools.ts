/**
 * Outreach & Call History Tools
 * Track data room access, buyer outreach status, and PhoneBurner call history.
 * Updated Feb 2026: Added get_call_history tool to expose PhoneBurner call data to AI.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const outreachTools: ClaudeTool[] = [
  {
    name: 'get_outreach_status',
    description:
      'Get outreach and data room access status for a deal — who has been contacted, who has data room access, pending outreach, and engagement timeline.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Optional: filter to a specific buyer' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'get_call_history',
    description:
      'Get PhoneBurner call history from the contact_activities table. Shows call attempts, completed calls, dispositions, talk time, recordings, and callbacks. Use to answer "has this contact been called?", "how many calls to this buyer?", "what was the outcome of the last call?", or "show rep calling activity".',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Filter by unified contact UUID' },
        remarketing_buyer_id: {
          type: 'string',
          description:
            'Filter by buyer UUID — returns all call activity for contacts at this buyer firm',
        },
        user_email: {
          type: 'string',
          description: 'Filter by rep/user email — shows calls made by a specific team member',
        },
        activity_type: {
          type: 'string',
          enum: [
            'call_attempt',
            'call_completed',
            'callback_scheduled',
            'contact_displayed',
            'all',
          ],
          description: 'Filter by activity type (default "all")',
        },
        disposition_code: { type: 'string', description: 'Filter by specific disposition code' },
        days: { type: 'number', description: 'Lookback period in days (default 90)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeOutreachTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_outreach_status':
      return getOutreachStatus(supabase, args);
    case 'get_call_history':
      return getCallHistory(supabase, args);
    default:
      return { error: `Unknown outreach tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function getOutreachStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;

  // Parallel fetch: data_room_access + deal_data_room_access + scores with status
  const queries: Promise<unknown>[] = [
    supabase
      .from('data_room_access')
      .select(
        'id, deal_id, remarketing_buyer_id, contact_id, can_view_teaser, can_view_full_memo, can_view_data_room, granted_at, granted_by, last_access_at, link_sent_at, link_sent_to_email, revoked_at',
      )
      .eq('deal_id', dealId),
    supabase
      .from('deal_data_room_access')
      .select(
        'id, deal_id, buyer_id, buyer_name, buyer_email, buyer_firm, is_active, granted_at, last_accessed_at, nda_signed_at, fee_agreement_signed_at, revoked_at',
      )
      .eq('deal_id', dealId),
    supabase
      .from('remarketing_scores')
      .select('buyer_id, status, composite_score, tier')
      .eq('listing_id', dealId),
  ];

  const [accessResult, dealAccessResult, scoresResult] = (await Promise.all(queries)) as [
    { data: unknown[] | null; error: { message: string } | null },
    { data: unknown[] | null; error: { message: string } | null },
    {
      data: Array<{
        buyer_id: string;
        status: string;
        composite_score: number;
        tier: string | null;
      }> | null;
      error: { message: string } | null;
    },
  ];

  if (accessResult.error) return { error: accessResult.error.message };

  const access = accessResult.data || [];
  const dealAccess = dealAccessResult.data || [];
  const scores = scoresResult.data || [];

  // Filter to specific buyer if requested
  let filteredAccess = access;
  let filteredDealAccess = dealAccess;
  if (args.buyer_id) {
    const bid = args.buyer_id as string;
    filteredAccess = access.filter((a: Record<string, unknown>) => a.remarketing_buyer_id === bid);
    filteredDealAccess = dealAccess.filter((a: Record<string, unknown>) => a.buyer_id === bid);
  }

  // Compute status summary from scores
  const statusCounts: Record<string, number> = {};
  for (const s of scores) {
    const st = s.status?.toUpperCase() || 'PENDING';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  return {
    data: {
      data_room_access: filteredAccess,
      deal_data_room_access: filteredDealAccess,
      buyer_status_summary: statusCounts,
      total_scored_buyers: scores.length,
      deal_id: dealId,
    },
  };
}

/**
 * Get PhoneBurner call history from the contact_activities table.
 * Surfaces call attempts, completed calls, dispositions, recordings, and callbacks.
 * This fills the gap identified in the audit: no AI tool previously queried call data.
 */
async function getCallHistory(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const days = Number(args.days) || 90;
  const activityType = (args.activity_type as string) || 'all';
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('contact_activities')
    .select(
      'id, activity_type, source_system, contact_id, remarketing_buyer_id, user_email, user_name, call_started_at, call_ended_at, call_duration_seconds, talk_time_seconds, call_outcome, disposition_code, disposition_label, disposition_notes, recording_url, recording_duration_seconds, callback_scheduled_date, callback_outcome, phoneburner_call_id, phoneburner_session_id, created_at',
    )
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.contact_id) query = query.eq('contact_id', args.contact_id as string);
  if (args.remarketing_buyer_id)
    query = query.eq('remarketing_buyer_id', args.remarketing_buyer_id as string);
  if (args.user_email) query = query.eq('user_email', args.user_email as string);
  if (activityType !== 'all') query = query.eq('activity_type', activityType);
  if (args.disposition_code) query = query.eq('disposition_code', args.disposition_code as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const activities = data || [];

  // Compute summary statistics
  const byType: Record<string, number> = {};
  const byDisposition: Record<string, number> = {};
  const byRep: Record<string, number> = {};
  let totalTalkTime = 0;
  let totalDuration = 0;
  let connectedCalls = 0;

  for (const a of activities) {
    byType[a.activity_type] = (byType[a.activity_type] || 0) + 1;
    if (a.disposition_label) {
      byDisposition[a.disposition_label] = (byDisposition[a.disposition_label] || 0) + 1;
    }
    if (a.user_email) {
      byRep[a.user_email] = (byRep[a.user_email] || 0) + 1;
    }
    if (a.talk_time_seconds) {
      totalTalkTime += a.talk_time_seconds;
      connectedCalls++;
    }
    if (a.call_duration_seconds) {
      totalDuration += a.call_duration_seconds;
    }
  }

  return {
    data: {
      activities,
      total: activities.length,
      summary: {
        by_type: byType,
        by_disposition: byDisposition,
        by_rep: byRep,
        total_talk_time_seconds: totalTalkTime,
        total_duration_seconds: totalDuration,
        connected_calls: connectedCalls,
        avg_talk_time_seconds: connectedCalls > 0 ? Math.round(totalTalkTime / connectedCalls) : 0,
      },
      lookback_days: days,
    },
  };
}
