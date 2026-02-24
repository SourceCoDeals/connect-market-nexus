/**
 * Unified Follow-Up Queue Tool
 * Aggregates all pending follow-ups: overdue tasks, stale outreach,
 * unsigned NDAs, unread messages, and upcoming due dates into a single view.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const followupTools: ClaudeTool[] = [
  {
    name: 'get_follow_up_queue',
    description: `Get a unified follow-up queue across all systems. Returns everything the user needs to act on today:
- Overdue deal tasks (past due_date)
- Stale outreach (no response in X business days)
- Unsigned NDAs / fee agreements with pending buyers
- Unread connection request messages
- Upcoming due dates (next 7 days)
Use this when the user asks "who do I need to follow up with?", "what's overdue?", or "what should I do today?"`,
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'User UUID. Use "CURRENT_USER" for the logged-in user.',
        },
        stale_days: {
          type: 'number',
          description: 'Days of no response before marking outreach as stale (default 5)',
        },
        include_upcoming: {
          type: 'boolean',
          description: 'Include tasks due in the next 7 days (default true)',
        },
        limit: {
          type: 'number',
          description: 'Max items per category (default 10)',
        },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeFollowupTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_follow_up_queue': return getFollowUpQueue(supabase, args, userId);
    default: return { error: `Unknown followup tool: ${toolName}` };
  }
}

// ---------- Implementation ----------

async function getFollowUpQueue(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const targetUserId = (args.user_id as string) || userId;
  const staleDays = (args.stale_days as number) || 5;
  const includeUpcoming = args.include_upcoming !== false;
  const limit = Math.min((args.limit as number) || 10, 25);

  const now = new Date();
  const staleDate = new Date(now);
  staleDate.setDate(staleDate.getDate() - staleDays);
  const staleDateStr = staleDate.toISOString();

  const upcomingDate = new Date(now);
  upcomingDate.setDate(upcomingDate.getDate() + 7);
  const upcomingDateStr = upcomingDate.toISOString();

  // Parallel queries for all follow-up categories
  const [
    overdueTasksResult,
    upcomingTasksResult,
    staleOutreachResult,
    pendingNdasResult,
    unreadMessagesResult,
  ] = await Promise.all([
    // 1. Overdue tasks
    supabase
      .from('deal_tasks')
      .select('id, title, deal_id, status, priority, due_date')
      .eq('assigned_to', targetUserId)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true })
      .limit(limit),

    // 2. Upcoming tasks (next 7 days)
    includeUpcoming
      ? supabase
          .from('deal_tasks')
          .select('id, title, deal_id, status, priority, due_date')
          .eq('assigned_to', targetUserId)
          .in('status', ['pending', 'in_progress'])
          .gte('due_date', now.toISOString())
          .lte('due_date', upcomingDateStr)
          .order('due_date', { ascending: true })
          .limit(limit)
      : Promise.resolve({ data: [], error: null }),

    // 3. Stale outreach (no update in staleDays)
    supabase
      .from('outreach_records')
      .select('id, buyer_name, deal_id, stage, last_action_date, next_action, next_action_date')
      .in('stage', ['nda_sent', 'intro_sent', 'cim_sent', 'meeting_scheduled'])
      .lt('last_action_date', staleDateStr)
      .order('last_action_date', { ascending: true })
      .limit(limit),

    // 4. Pending NDAs/fee agreements
    supabase
      .from('firm_agreements')
      .select('id, primary_company_name, nda_signed, fee_agreement_signed, created_at')
      .eq('nda_signed', false)
      .order('created_at', { ascending: true })
      .limit(limit),

    // 5. Unread connection request messages
    supabase
      .from('connection_messages')
      .select('id, body, sender_role, created_at, connection_request_id')
      .eq('is_read_by_admin', false)
      .eq('sender_role', 'buyer')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const overdueTasks = overdueTasksResult.data || [];
  const upcomingTasks = upcomingTasksResult.data || [];
  const staleOutreach = staleOutreachResult.data || [];
  const pendingNdas = pendingNdasResult.data || [];
  const unreadMessages = unreadMessagesResult.data || [];

  const totalItems = overdueTasks.length + staleOutreach.length + pendingNdas.length + unreadMessages.length;

  return {
    data: {
      summary: {
        total_action_items: totalItems,
        overdue_tasks: overdueTasks.length,
        stale_outreach: staleOutreach.length,
        pending_ndas: pendingNdas.length,
        unread_messages: unreadMessages.length,
        upcoming_tasks: upcomingTasks.length,
      },
      overdue_tasks: overdueTasks.map(t => ({
        id: t.id,
        title: t.title,
        deal_id: t.deal_id,
        priority: t.priority,
        due_date: t.due_date,
        days_overdue: Math.floor((now.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      stale_outreach: staleOutreach.map(o => ({
        id: o.id,
        buyer_name: o.buyer_name,
        deal_id: o.deal_id,
        stage: o.stage,
        last_action_date: o.last_action_date,
        days_since_action: Math.floor((now.getTime() - new Date(o.last_action_date).getTime()) / (1000 * 60 * 60 * 24)),
        next_action: o.next_action,
      })),
      pending_ndas: pendingNdas.map(n => ({
        id: n.id,
        company: n.primary_company_name,
        has_fee_agreement: n.fee_agreement_signed,
        created_at: n.created_at,
      })),
      unread_messages: unreadMessages.map(m => ({
        id: m.id,
        preview: (m.body || '').substring(0, 100),
        connection_request_id: m.connection_request_id,
        created_at: m.created_at,
      })),
      upcoming_tasks: upcomingTasks.map(t => ({
        id: t.id,
        title: t.title,
        deal_id: t.deal_id,
        priority: t.priority,
        due_date: t.due_date,
      })),
      source_tables: ['deal_tasks', 'outreach_records', 'firm_agreements', 'connection_messages'],
    },
  };
}
