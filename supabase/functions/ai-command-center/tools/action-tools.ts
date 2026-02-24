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

/**
 * Update deal stage via the deal_stages lookup table.
 * Updated Feb 2026: The pipeline UI reads deals.stage_id (FK to deal_stages), NOT listings.remarketing_status.
 * We now look up the stage by name in deal_stages and update deals.stage_id accordingly.
 */
async function updateDealStage(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const newStage = args.new_stage as string;

  // Look up the target stage in deal_stages
  const { data: stageRecord, error: stageError } = await supabase
    .from('deal_stages')
    .select('id, name')
    .ilike('name', newStage)
    .limit(1)
    .single();

  if (stageError || !stageRecord) {
    // Fetch valid stage names to return a helpful error
    const { data: validStages } = await supabase
      .from('deal_stages')
      .select('name')
      .order('display_order', { ascending: true });
    const stageNames = (validStages || []).map((s: { name: string }) => s.name);
    return {
      error: `Invalid stage "${newStage}". Valid stages are: ${stageNames.join(', ')}`,
    };
  }

  // Get current deal info including current stage
  const { data: current } = await supabase
    .from('deals')
    .select('stage_id, title')
    .eq('id', dealId)
    .single();

  // If deal not found in deals table, try listings for backward compat
  let dealTitle = current?.title;
  let oldStageId = current?.stage_id;
  if (!current) {
    const { data: listing } = await supabase
      .from('listings')
      .select('title, remarketing_status')
      .eq('id', dealId)
      .single();
    dealTitle = listing?.title;
  }

  // Look up old stage name for logging
  let oldStageName = 'unknown';
  if (oldStageId) {
    const { data: oldStageRecord } = await supabase
      .from('deal_stages')
      .select('name')
      .eq('id', oldStageId)
      .single();
    if (oldStageRecord) oldStageName = oldStageRecord.name;
  }

  // Update deals.stage_id
  const { error: updateError } = await supabase
    .from('deals')
    .update({ stage_id: stageRecord.id, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  if (updateError) return { error: updateError.message };

  // Log the activity
  await supabase.from('deal_activities').insert({
    deal_id: dealId,
    activity_type: 'status_change',
    title: `Stage changed: ${oldStageName} → ${stageRecord.name}`,
    description: args.reason ? `Reason: ${args.reason}` : `AI Command Center updated stage from ${oldStageName} to ${stageRecord.name}`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', old_stage: oldStageName, old_stage_id: oldStageId, new_stage: stageRecord.name, new_stage_id: stageRecord.id },
  });

  return {
    data: {
      deal_id: dealId,
      deal_title: dealTitle,
      old_stage: oldStageName,
      new_stage: stageRecord.name,
      new_stage_id: stageRecord.id,
      message: `Deal "${dealTitle}" stage updated: ${oldStageName} → ${stageRecord.name}`,
    },
  };
}

/**
 * Grant data room access to a buyer.
 * Updated Feb 2026: Writes to data_room_access only (deal_data_room_access is legacy).
 * Populates contact_id by looking up the buyer's primary contact in the unified contacts table.
 */
async function grantDataRoomAccess(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const buyerId = args.buyer_id as string;
  const buyerEmail = args.buyer_email as string;
  const accessLevel = (args.access_level as string) || 'teaser';

  // Look up contact_id from unified contacts table
  // Try matching by remarketing_buyer_id + is_primary_at_firm first, fall back to email match
  let contactId: string | null = null;
  const { data: primaryContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('remarketing_buyer_id', buyerId)
    .eq('is_primary_at_firm', true)
    .eq('archived', false)
    .limit(1)
    .single();

  if (primaryContact) {
    contactId = primaryContact.id;
  } else if (buyerEmail) {
    // Fall back to email match
    const { data: emailContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', buyerEmail)
      .eq('contact_type', 'buyer')
      .eq('archived', false)
      .limit(1)
      .single();
    if (emailContact) contactId = emailContact.id;
  }

  // Write to data_room_access (the authoritative table)
  const { data, error } = await supabase.from('data_room_access').insert({
    deal_id: dealId,
    remarketing_buyer_id: buyerId,
    contact_id: contactId,
    can_view_teaser: true,
    can_view_full_memo: accessLevel === 'memo' || accessLevel === 'full',
    can_view_data_room: accessLevel === 'full',
    granted_by: userId,
    granted_at: new Date().toISOString(),
  })
    .select('id, remarketing_buyer_id, contact_id, can_view_teaser, can_view_full_memo, can_view_data_room, granted_at')
    .single();

  if (error) return { error: error.message };

  // Log activity
  await supabase.from('deal_activities').insert({
    deal_id: dealId,
    activity_type: 'data_room',
    title: `Data room access granted to ${args.buyer_name}`,
    description: `${accessLevel} access granted to ${args.buyer_name} (${buyerEmail})`,
    admin_id: userId,
    metadata: { source: 'ai_command_center', buyer_id: buyerId, contact_id: contactId, access_level: accessLevel },
  });

  return {
    data: {
      access: data,
      access_level: accessLevel,
      contact_id: contactId,
      message: `Data room access (${accessLevel}) granted to ${args.buyer_name}${contactId ? '' : ' (warning: no matching contact found in contacts table)'}`,
    },
  };
}
