/**
 * User Context Tools
 * Fetch current user profile and context for personalized responses.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Tool definitions ----------

export const userTools: ClaudeTool[] = [
  {
    name: 'get_current_user_context',
    description:
      "Get the current user's profile, role, recent notifications, and assigned tasks. Used to personalize responses and understand the user's responsibilities.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeUserTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_current_user_context':
      return getCurrentUserContext(supabase, userId);
    default:
      return { error: `Unknown user tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function getCurrentUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<ToolResult> {
  // Parallel fetch: profile + assigned tasks + recent notifications + owned deals
  const [profileResult, tasksResult, notificationsResult, ownedDealsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, is_admin, company, job_title')
      .eq('id', userId)
      .single(),
    supabase
      .from('daily_standup_tasks')
      .select('id, title, entity_id, status, priority, due_date')
      .eq('assignee_id', userId)
      .in('status', ['pending', 'in_progress', 'pending_approval', 'overdue'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from('admin_notifications')
      .select('id, title, message, type, read, created_at')
      .eq('admin_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('listings')
      .select('id, title, status, deal_source')
      .or(`deal_owner_id.eq.${userId},primary_owner_id.eq.${userId}`)
      .is('deleted_at', null)
      .eq('status', 'active')
      .limit(20),
  ]);

  if (profileResult.error) return { error: profileResult.error.message };

  const tasks = tasksResult.data || [];
  const overdueTasks = tasks.filter((t: { due_date?: string }) => t.due_date && new Date(t.due_date) < new Date());

  return {
    data: {
      user: profileResult.data,
      assigned_tasks: {
        items: tasks,
        total: tasks.length,
        overdue: overdueTasks.length,
      },
      unread_notifications: {
        items: notificationsResult.data || [],
        total: (notificationsResult.data || []).length,
      },
      owned_deals: {
        items: ownedDealsResult.data || [],
        total: (ownedDealsResult.data || []).length,
      },
    },
  };
}
