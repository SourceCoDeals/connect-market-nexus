/**
 * Action Tools (Write-Back)
 * Create tasks, add notes, update stages, grant data room access.
 * These tools MODIFY data — some require user confirmation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const actionTools: ClaudeTool[] = [
  {
    name: 'create_deal_task',
    description: 'Create a new task/to-do for a deal. Can assign to a team member with priority and due date.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description/details' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority (default "medium")' },
        due_date: { type: 'string', description: 'Due date in ISO format (YYYY-MM-DD)' },
        assigned_to: { type: 'string', description: 'User ID to assign to. Use "CURRENT_USER" for self-assignment.' },
      },
      required: ['deal_id', 'title'],
    },
  },
  {
    name: 'complete_deal_task',
    description: 'Mark a deal task as completed.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The task UUID to complete' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_deal_note',
    description: 'Add a note/comment to a deal activity log.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        title: { type: 'string', description: 'Note title/subject' },
        content: { type: 'string', description: 'Note content' },
        activity_type: { type: 'string', description: 'Activity type (default "note"). Options: note, call, email, meeting, status_change' },
      },
      required: ['deal_id', 'title', 'content'],
    },
  },
  {
    name: 'log_deal_activity',
    description: 'Log a deal activity event (call, meeting, outreach, status change).',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        activity_type: { type: 'string', description: 'Type of activity: note, call, email, meeting, outreach, status_change, data_room, scoring' },
        title: { type: 'string', description: 'Activity title' },
        description: { type: 'string', description: 'Activity description' },
        metadata: { type: 'object', description: 'Additional structured metadata' },
      },
      required: ['deal_id', 'activity_type', 'title'],
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Update the remarketing status/stage of a deal. REQUIRES CONFIRMATION. Valid stages: sourced, contacted, interested, nda_sent, nda_signed, data_room_open, loi_submitted, under_exclusivity, closed, passed.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        new_stage: { type: 'string', description: 'New remarketing status' },
        reason: { type: 'string', description: 'Reason for the stage change' },
      },
      required: ['deal_id', 'new_stage'],
    },
  },
  {
    name: 'grant_data_room_access',
    description: 'Grant a buyer access to a deal\'s data room. REQUIRES CONFIRMATION. Creates access record and can set permission levels.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        buyer_id: { type: 'string', description: 'The remarketing buyer UUID' },
        buyer_name: { type: 'string', description: 'Buyer name (for display)' },
        buyer_email: { type: 'string', description: 'Buyer contact email' },
        access_level: { type: 'string', enum: ['teaser', 'memo', 'full'], description: 'Level of access (default "teaser")' },
      },
      required: ['deal_id', 'buyer_id', 'buyer_name', 'buyer_email'],
    },
  },
];

// ---------- Executor ----------

export async function executeActionTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'create_deal_task': return createDealTask(supabase, args, userId);
    case 'complete_deal_task': return completeDealTask(supabase, args, userId);
    case 'add_deal_note': return addDealNote(supabase, args, userId);
    case 'log_deal_activity': return logDealActivity(supabase, args, userId);
    case 'update_deal_stage': return updateDealStage(supabase, args, userId);
    case 'grant_data_room_access': return grantDataRoomAccess(supabase, args, userId);
    default: return { error: `Unknown action tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function createDealTask(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('deal_tasks')
    .insert({
      deal_id: args.deal_id as string,
      title: args.title as string,
      description: (args.description as string) || null,
      priority: (args.priority as string) || 'medium',
      due_date: (args.due_date as string) || null,
      assigned_to: (args.assigned_to as string) || userId,
      assigned_by: userId,
      status: 'pending',
    })
    .select('id, title, status, priority, due_date, assigned_to')
    .single();

  if (error) return { error: error.message };

  // Log the activity
  await supabase.from('deal_activities').insert({
    deal_id: args.deal_id as string,
    activity_type: 'task_created',
    title: `Task created: ${args.title}`,
    description: `AI Command Center created task "${args.title}" with priority ${args.priority || 'medium'}`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', task_id: data.id },
  });

  return {
    data: {
      task: data,
      message: `Task "${data.title}" created successfully`,
    },
  };
}

async function completeDealTask(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('deal_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userId,
    })
    .eq('id', args.task_id as string)
    .select('id, title, deal_id, status, completed_at')
    .single();

  if (error) return { error: error.message };

  // Log the activity
  await supabase.from('deal_activities').insert({
    deal_id: data.deal_id,
    activity_type: 'task_completed',
    title: `Task completed: ${data.title}`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', task_id: data.id },
  });

  return {
    data: {
      task: data,
      message: `Task "${data.title}" marked as completed`,
    },
  };
}

async function addDealNote(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const activityType = (args.activity_type as string) || 'note';

  const { data, error } = await supabase
    .from('deal_activities')
    .insert({
      deal_id: args.deal_id as string,
      activity_type: activityType,
      title: args.title as string,
      description: args.content as string,
      admin_id: userId,
      metadata: { source: 'ai_command_center' },
    })
    .select('id, title, activity_type, created_at')
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      activity: data,
      message: `Note added: "${data.title}"`,
    },
  };
}

async function logDealActivity(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('deal_activities')
    .insert({
      deal_id: args.deal_id as string,
      activity_type: args.activity_type as string,
      title: args.title as string,
      description: (args.description as string) || null,
      admin_id: userId,
      metadata: { ...(args.metadata as Record<string, unknown> || {}), source: 'ai_command_center' },
    })
    .select('id, title, activity_type, created_at')
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      activity: data,
      message: `Activity logged: "${data.title}" (${data.activity_type})`,
    },
  };
}

async function updateDealStage(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const newStage = args.new_stage as string;

  // Get current stage first
  const { data: current } = await supabase
    .from('listings')
    .select('remarketing_status, title')
    .eq('id', dealId)
    .single();

  const oldStage = current?.remarketing_status || 'unknown';

  // Update the stage
  const { error } = await supabase
    .from('listings')
    .update({ remarketing_status: newStage, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  if (error) return { error: error.message };

  // Log the activity
  await supabase.from('deal_activities').insert({
    deal_id: dealId,
    activity_type: 'status_change',
    title: `Stage changed: ${oldStage} → ${newStage}`,
    description: args.reason ? `Reason: ${args.reason}` : `AI Command Center updated stage from ${oldStage} to ${newStage}`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', old_stage: oldStage, new_stage: newStage },
  });

  return {
    data: {
      deal_id: dealId,
      deal_title: current?.title,
      old_stage: oldStage,
      new_stage: newStage,
      message: `Deal "${current?.title}" stage updated: ${oldStage} → ${newStage}`,
    },
  };
}

async function grantDataRoomAccess(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const accessLevel = (args.access_level as string) || 'teaser';

  const { data, error } = await supabase
    .from('deal_data_room_access')
    .insert({
      deal_id: dealId,
      buyer_id: args.buyer_id as string,
      buyer_name: args.buyer_name as string,
      buyer_email: args.buyer_email as string,
      buyer_firm: (args.buyer_firm as string) || null,
      granted_by: userId,
      is_active: true,
    })
    .select('id, buyer_name, buyer_email, granted_at')
    .single();

  if (error) return { error: error.message };

  // Also create the permissions record in data_room_access
  await supabase.from('data_room_access').insert({
    deal_id: dealId,
    remarketing_buyer_id: args.buyer_id as string,
    can_view_teaser: true,
    can_view_full_memo: accessLevel === 'memo' || accessLevel === 'full',
    can_view_data_room: accessLevel === 'full',
    granted_by: userId,
    granted_at: new Date().toISOString(),
  });

  // Log activity
  await supabase.from('deal_activities').insert({
    deal_id: dealId,
    activity_type: 'data_room',
    title: `Data room access granted to ${args.buyer_name}`,
    description: `${accessLevel} access granted to ${args.buyer_name} (${args.buyer_email})`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', buyer_id: args.buyer_id, access_level: accessLevel },
  });

  return {
    data: {
      access: data,
      access_level: accessLevel,
      message: `Data room access (${accessLevel}) granted to ${args.buyer_name}`,
    },
  };
}
