/**
 * AI Command Center - Tool Registry & Executor
 * Central registry for all tools the AI can call.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import { dealTools, executeDealTool } from "./deal-tools.ts";
import { buyerTools, executeBuyerTool } from "./buyer-tools.ts";
import { transcriptTools, executeTranscriptTool } from "./transcript-tools.ts";
import { outreachTools, executeOutreachTool } from "./outreach-tools.ts";
import { analyticsTools, executeAnalyticsTool } from "./analytics-tools.ts";
import { userTools, executeUserTool } from "./user-tools.ts";
import { actionTools, executeActionTool } from "./action-tools.ts";
import { uiActionTools, executeUIActionTool } from "./ui-action-tools.ts";
import { contentTools, executeContentTool } from "./content-tools.ts";

// ---------- Tool Result Types ----------

export interface ToolResult {
  data?: unknown;
  error?: string;
  partial?: boolean;
}

// ---------- All tool definitions ----------

const ALL_TOOLS: ClaudeTool[] = [
  ...dealTools,
  ...buyerTools,
  ...transcriptTools,
  ...outreachTools,
  ...analyticsTools,
  ...userTools,
  ...actionTools,
  ...uiActionTools,
  ...contentTools,
];

const TOOL_CATEGORIES: Record<string, string[]> = {
  DEAL_STATUS: ['query_deals', 'get_deal_details', 'get_deal_activities', 'get_pipeline_summary'],
  FOLLOW_UP: ['get_deal_tasks', 'get_outreach_status', 'get_meeting_action_items', 'get_current_user_context'],
  BUYER_SEARCH: ['search_buyers', 'search_lead_sources'],
  BUYER_ANALYSIS: ['get_buyer_profile', 'get_score_breakdown', 'get_top_buyers_for_deal'],
  MEETING_INTEL: ['search_transcripts', 'search_fireflies', 'get_meeting_action_items'],
  PIPELINE_ANALYTICS: ['get_pipeline_summary', 'get_analytics'],
  DAILY_BRIEFING: ['get_current_user_context', 'query_deals', 'get_deal_tasks', 'get_outreach_status', 'get_analytics'],
  GENERAL: ['get_current_user_context'],
  ACTION: ['create_deal_task', 'complete_deal_task', 'add_deal_note', 'log_deal_activity', 'update_deal_stage', 'grant_data_room_access'],
  UI_ACTION: ['select_table_rows', 'apply_table_filter', 'navigate_to_page'],
  REMARKETING: ['search_buyers', 'get_top_buyers_for_deal', 'get_score_breakdown', 'select_table_rows', 'apply_table_filter'],
  MEETING_PREP: ['generate_meeting_prep'],
  OUTREACH_DRAFT: ['draft_outreach_email'],
  PIPELINE_REPORT: ['generate_pipeline_report'],
};

// Tools that require user confirmation before executing
const CONFIRMATION_REQUIRED = new Set([
  'update_deal_stage',
  'grant_data_room_access',
]);

// ---------- Public API ----------

/**
 * Get tools available for a given intent category.
 */
export function getToolsForCategory(category: string, specificTools?: string[]): ClaudeTool[] {
  if (specificTools && specificTools.length > 0) {
    return ALL_TOOLS.filter(t => specificTools.includes(t.name));
  }
  const toolNames = TOOL_CATEGORIES[category] || TOOL_CATEGORIES.GENERAL;
  return ALL_TOOLS.filter(t => toolNames.includes(t.name));
}

/**
 * Get all available tools.
 */
export function getAllTools(): ClaudeTool[] {
  return ALL_TOOLS;
}

/**
 * Check if a tool requires user confirmation.
 */
export function requiresConfirmation(toolName: string): boolean {
  return CONFIRMATION_REQUIRED.has(toolName);
}

/**
 * Execute a tool call by name, routing to the appropriate handler.
 */
export async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    // 5-second hard timeout per tool
    const result = await Promise.race([
      _executeToolInternal(supabase, toolName, args, userId),
      new Promise<ToolResult>((_, reject) =>
        setTimeout(() => reject(new Error('Tool timeout (5s)')), 5000)
      ),
    ]);

    const durationMs = Date.now() - startTime;
    console.log(`[ai-cc] Tool ${toolName} completed in ${durationMs}ms`);
    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-cc] Tool ${toolName} failed after ${durationMs}ms: ${message}`);

    // Return partial/error result instead of throwing
    return { error: message, partial: message.includes('timeout') };
  }
}

async function _executeToolInternal(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  // Resolve CURRENT_USER references
  const resolvedArgs = resolveCurrentUser(args, userId);

  // Route to category handler
  if (dealTools.some(t => t.name === toolName)) {
    return executeDealTool(supabase, toolName, resolvedArgs);
  }
  if (buyerTools.some(t => t.name === toolName)) {
    return executeBuyerTool(supabase, toolName, resolvedArgs);
  }
  if (transcriptTools.some(t => t.name === toolName)) {
    return executeTranscriptTool(supabase, toolName, resolvedArgs);
  }
  if (outreachTools.some(t => t.name === toolName)) {
    return executeOutreachTool(supabase, toolName, resolvedArgs);
  }
  if (analyticsTools.some(t => t.name === toolName)) {
    return executeAnalyticsTool(supabase, toolName, resolvedArgs);
  }
  if (userTools.some(t => t.name === toolName)) {
    return executeUserTool(supabase, toolName, resolvedArgs, userId);
  }
  if (actionTools.some(t => t.name === toolName)) {
    return executeActionTool(supabase, toolName, resolvedArgs, userId);
  }
  if (uiActionTools.some(t => t.name === toolName)) {
    return executeUIActionTool(supabase, toolName, resolvedArgs);
  }
  if (contentTools.some(t => t.name === toolName)) {
    return executeContentTool(supabase, toolName, resolvedArgs);
  }

  return { error: `Unknown tool: ${toolName}` };
}

/**
 * Replace 'CURRENT_USER' string values with actual userId.
 */
function resolveCurrentUser(args: Record<string, unknown>, userId: string): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = value === 'CURRENT_USER' ? userId : value;
  }
  return resolved;
}
