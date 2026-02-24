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
import { universeTools, executeUniverseTool } from "./universe-tools.ts";
import { signalTools, executeSignalTool } from "./signal-tools.ts";
import { leadTools, executeLeadTool } from "./lead-tools.ts";
import { contactTools, executeContactTool } from "./contact-tools.ts";
import { connectionTools, executeConnectionTool } from "./connection-tools.ts";
import { dealExtraTools, executeDealExtraTool } from "./deal-extra-tools.ts";
import { followupTools, executeFollowupTool } from "./followup-tools.ts";
import { scoringExplainTools, executeScoringExplainTool } from "./scoring-explain-tools.ts";
import { crossDealAnalyticsTools, executeCrossDealAnalyticsTool } from "./cross-deal-analytics-tools.ts";
import { semanticSearchTools, executeSemanticSearchTool } from "./semantic-search-tools.ts";

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
  ...universeTools,
  ...signalTools,
  ...leadTools,
  ...contactTools,
  ...connectionTools,
  ...dealExtraTools,
  ...followupTools,
  ...scoringExplainTools,
  ...crossDealAnalyticsTools,
  ...semanticSearchTools,
];

const TOOL_CATEGORIES: Record<string, string[]> = {
  // Deal pipeline
  DEAL_STATUS: ['query_deals', 'get_deal_details', 'get_deal_activities', 'get_pipeline_summary', 'get_deal_memos', 'get_deal_documents', 'get_deal_comments', 'get_deal_scoring_adjustments'],
  FOLLOW_UP: ['get_deal_tasks', 'get_outreach_status', 'get_outreach_records', 'get_remarketing_outreach', 'get_meeting_action_items', 'get_current_user_context', 'get_connection_requests', 'get_follow_up_queue'],

  // Buyer intelligence
  BUYER_SEARCH: ['search_buyers', 'search_lead_sources', 'search_valuation_leads', 'query_deals', 'search_inbound_leads', 'select_table_rows', 'apply_table_filter', 'sort_table_column'],
  BUYER_ANALYSIS: ['get_buyer_profile', 'get_score_breakdown', 'explain_buyer_score', 'get_top_buyers_for_deal', 'get_buyer_decisions', 'get_score_history', 'search_pe_contacts', 'get_buyer_learning_history', 'select_table_rows'],

  // Universe & outreach
  BUYER_UNIVERSE: ['search_buyer_universes', 'get_universe_details', 'get_outreach_records', 'get_remarketing_outreach', 'get_top_buyers_for_deal'],

  // Meeting intelligence
  MEETING_INTEL: ['search_buyer_transcripts', 'search_transcripts', 'search_fireflies', 'get_meeting_action_items', 'semantic_transcript_search'],

  // Analytics
  PIPELINE_ANALYTICS: ['get_pipeline_summary', 'query_deals', 'get_analytics', 'get_enrichment_status', 'get_industry_trackers', 'get_cross_deal_analytics'],
  DAILY_BRIEFING: ['get_current_user_context', 'get_follow_up_queue', 'get_cross_deal_analytics', 'get_analytics', 'get_deal_tasks', 'get_outreach_status', 'get_connection_requests'],

  // General / context
  GENERAL: ['get_current_user_context'],

  // Actions
  ACTION: ['create_deal_task', 'complete_deal_task', 'add_deal_note', 'log_deal_activity', 'update_deal_stage', 'grant_data_room_access'],
  UI_ACTION: ['select_table_rows', 'apply_table_filter', 'sort_table_column', 'navigate_to_page'],

  // Remarketing workflow
  REMARKETING: ['search_buyers', 'get_top_buyers_for_deal', 'get_score_breakdown', 'explain_buyer_score', 'select_table_rows', 'apply_table_filter', 'sort_table_column', 'get_engagement_signals', 'get_buyer_decisions'],

  // Content generation
  MEETING_PREP: ['generate_meeting_prep', 'search_transcripts', 'search_buyer_transcripts', 'semantic_transcript_search', 'get_outreach_records', 'get_connection_messages'],
  OUTREACH_DRAFT: ['get_deal_details', 'get_buyer_profile', 'draft_outreach_email', 'search_pe_contacts', 'get_firm_agreements'],
  PIPELINE_REPORT: ['generate_pipeline_report'],

  // Lead & referral
  LEAD_INTEL: ['search_inbound_leads', 'get_referral_data', 'search_valuation_leads', 'search_lead_sources', 'get_deal_referrals'],

  // Signals & engagement
  ENGAGEMENT: ['get_engagement_signals', 'get_interest_signals', 'get_buyer_decisions', 'get_score_history', 'get_buyer_learning_history'],

  // Connection requests & conversations
  CONNECTION: ['get_connection_requests', 'get_connection_messages', 'get_deal_conversations'],

  // Contacts & agreements
  CONTACTS: ['search_pe_contacts', 'get_buyer_profile', 'get_firm_agreements', 'get_nda_logs'],

  // Industry trackers
  INDUSTRY: ['get_industry_trackers', 'search_buyer_universes'],

  // Cross-deal analytics
  CROSS_DEAL: ['get_cross_deal_analytics', 'get_analytics', 'get_pipeline_summary'],

  // Semantic search
  SEMANTIC_SEARCH: ['semantic_transcript_search', 'search_buyer_transcripts', 'search_transcripts'],
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
    // 15-second hard timeout per tool
    const result = await Promise.race([
      _executeToolInternal(supabase, toolName, args, userId),
      new Promise<ToolResult>((_, reject) =>
        setTimeout(() => reject(new Error('Tool timeout (15s)')), 15000)
      ),
    ]);

    const durationMs = Date.now() - startTime;
    console.log(`[ai-cc] Tool ${toolName} completed in ${durationMs}ms`);
    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-cc] Tool ${toolName} failed after ${durationMs}ms: ${message}`);
    return { error: message, partial: message.includes('timeout') };
  }
}

async function _executeToolInternal(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const resolvedArgs = resolveCurrentUser(args, userId);

  if (dealTools.some(t => t.name === toolName)) return executeDealTool(supabase, toolName, resolvedArgs);
  if (buyerTools.some(t => t.name === toolName)) return executeBuyerTool(supabase, toolName, resolvedArgs);
  if (transcriptTools.some(t => t.name === toolName)) return executeTranscriptTool(supabase, toolName, resolvedArgs);
  if (outreachTools.some(t => t.name === toolName)) return executeOutreachTool(supabase, toolName, resolvedArgs);
  if (analyticsTools.some(t => t.name === toolName)) return executeAnalyticsTool(supabase, toolName, resolvedArgs);
  if (userTools.some(t => t.name === toolName)) return executeUserTool(supabase, toolName, resolvedArgs, userId);
  if (actionTools.some(t => t.name === toolName)) return executeActionTool(supabase, toolName, resolvedArgs, userId);
  if (uiActionTools.some(t => t.name === toolName)) return executeUIActionTool(supabase, toolName, resolvedArgs);
  if (contentTools.some(t => t.name === toolName)) return executeContentTool(supabase, toolName, resolvedArgs);
  if (universeTools.some(t => t.name === toolName)) return executeUniverseTool(supabase, toolName, resolvedArgs);
  if (signalTools.some(t => t.name === toolName)) return executeSignalTool(supabase, toolName, resolvedArgs);
  if (leadTools.some(t => t.name === toolName)) return executeLeadTool(supabase, toolName, resolvedArgs);
  if (contactTools.some(t => t.name === toolName)) return executeContactTool(supabase, toolName, resolvedArgs);
  if (connectionTools.some(t => t.name === toolName)) return executeConnectionTool(supabase, toolName, resolvedArgs);
  if (dealExtraTools.some(t => t.name === toolName)) return executeDealExtraTool(supabase, toolName, resolvedArgs);
  if (followupTools.some(t => t.name === toolName)) return executeFollowupTool(supabase, toolName, resolvedArgs, userId);
  if (scoringExplainTools.some(t => t.name === toolName)) return executeScoringExplainTool(supabase, toolName, resolvedArgs);
  if (crossDealAnalyticsTools.some(t => t.name === toolName)) return executeCrossDealAnalyticsTool(supabase, toolName, resolvedArgs);
  if (semanticSearchTools.some(t => t.name === toolName)) return executeSemanticSearchTool(supabase, toolName, resolvedArgs);

  return { error: `Unknown tool: ${toolName}` };
}

function resolveCurrentUser(args: Record<string, unknown>, userId: string): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = value === 'CURRENT_USER' ? userId : value;
  }
  return resolved;
}
