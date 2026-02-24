/**
 * Signal & Intelligence Tools
 * Engagement signals, buyer decisions, score history, interest signals.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const signalTools: ClaudeTool[] = [
  {
    name: 'get_engagement_signals',
    description: 'Get buyer engagement signals for a deal or buyer — site visits, financial requests, NDA signed, CEO involvement, IOI/LOI submitted, meeting activity, email engagement. Use to gauge buyer interest level.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        signal_type: {
          type: 'string',
          description: 'Filter by type: site_visit, financial_request, ceo_involvement, nda_signed, ioi_submitted, loi_submitted, call_scheduled, management_presentation, data_room_access, email_engagement',
        },
        days: { type: 'number', description: 'Lookback period in days (default 30)' },
        limit: { type: 'number', description: 'Max results (default 100)' },
      },
      required: [],
    },
  },
  {
    name: 'get_buyer_decisions',
    description: 'Get history of approve/pass decisions for buyers on deals, including pass reasons and categories. Also includes the buyer learning history with score context at time of decision.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        decision_type: { type: 'string', enum: ['approved', 'passed', 'all'], description: 'Filter by decision type (default "all")' },
        pass_category: { type: 'string', description: 'Filter by pass category: geographic_mismatch, size_mismatch, service_mismatch, acquisition_timing, competition, other' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_score_history',
    description: 'Get historical score snapshots for a buyer-deal pair. Shows how composite and dimension scores changed over time. Use to answer "how has this buyer\'s score changed?" questions.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        universe_id: { type: 'string', description: 'Filter by universe UUID' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_interest_signals',
    description: 'Get interest signals from marketplace users — seller/owner interest in deals, conversion to connection requests. Shows which sellers are engaging with the platform.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        converted_only: { type: 'boolean', description: 'Only show signals that converted to connection requests' },
        days: { type: 'number', description: 'Lookback period in days (default 30)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_buyer_learning_history',
    description: 'Get the learning history of buyer approve/pass decisions with scores at the time of each decision — shows what score a buyer had when approved or passed, which dimension scores (geography, size, service, owner_goals) drove the decision, and the pass reason/category. Use to understand patterns in buyer decisions and score-to-decision correlations.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        universe_id: { type: 'string', description: 'Filter by buyer universe UUID' },
        action: { type: 'string', enum: ['approved', 'passed', 'hidden', 'all'], description: 'Filter by decision action (default "all")' },
        pass_category: { type: 'string', description: 'Filter by pass category: geographic_mismatch, size_mismatch, service_mismatch, acquisition_timing, competition, other' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeSignalTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_engagement_signals': return getEngagementSignals(supabase, args);
    case 'get_buyer_decisions': return getBuyerDecisions(supabase, args);
    case 'get_score_history': return getScoreHistory(supabase, args);
    case 'get_interest_signals': return getInterestSignals(supabase, args);
    case 'get_buyer_learning_history': return getBuyerLearningHistory(supabase, args);
    default: return { error: `Unknown signal tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function getEngagementSignals(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 100, 1000);
  const days = Number(args.days) || 30;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('engagement_signals')
    .select('id, listing_id, buyer_id, signal_type, signal_value, signal_date, source, notes, created_at')
    .gte('signal_date', cutoff)
    .order('signal_date', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.signal_type) query = query.eq('signal_type', args.signal_type as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const signals = data || [];
  const byType: Record<string, number> = {};
  const byBuyer: Record<string, number> = {};
  for (const s of signals) {
    byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
    if (s.buyer_id) byBuyer[s.buyer_id] = (byBuyer[s.buyer_id] || 0) + 1;
  }

  return {
    data: {
      signals,
      total: signals.length,
      by_type: byType,
      most_engaged_buyers: Object.entries(byBuyer).sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
  };
}

async function getBuyerDecisions(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const decisionType = (args.decision_type as string) || 'all';

  const queries: Promise<unknown>[] = [];

  // Fetch approved decisions if requested
  if (decisionType === 'all' || decisionType === 'approved') {
    let approvedQuery = supabase
      .from('buyer_approve_decisions')
      .select('id, listing_id, buyer_id, user_id, approval_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (args.deal_id) approvedQuery = approvedQuery.eq('listing_id', args.deal_id as string);
    if (args.buyer_id) approvedQuery = approvedQuery.eq('buyer_id', args.buyer_id as string);
    queries.push(approvedQuery);
  } else {
    queries.push(Promise.resolve({ data: [], error: null }));
  }

  // Fetch pass decisions if requested
  if (decisionType === 'all' || decisionType === 'passed') {
    let passedQuery = supabase
      .from('buyer_pass_decisions')
      .select('id, listing_id, buyer_id, user_id, pass_reason, pass_category, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (args.deal_id) passedQuery = passedQuery.eq('listing_id', args.deal_id as string);
    if (args.buyer_id) passedQuery = passedQuery.eq('buyer_id', args.buyer_id as string);
    if (args.pass_category) passedQuery = passedQuery.eq('pass_category', args.pass_category as string);
    queries.push(passedQuery);
  } else {
    queries.push(Promise.resolve({ data: [], error: null }));
  }

  const [approvedResult, passedResult] = await Promise.all(queries) as [
    { data: unknown[]; error: unknown },
    { data: unknown[]; error: unknown },
  ];

  const approved = (approvedResult.data || []).map(d => ({ ...d as object, decision: 'approved' }));
  const passed = (passedResult.data || []).map(d => ({ ...d as object, decision: 'passed' }));

  const passByCategory: Record<string, number> = {};
  for (const p of passed as Array<{ pass_category?: string }>) {
    const cat = p.pass_category || 'other';
    passByCategory[cat] = (passByCategory[cat] || 0) + 1;
  }

  return {
    data: {
      approved,
      passed,
      total_approved: approved.length,
      total_passed: passed.length,
      pass_by_category: passByCategory,
    },
  };
}

async function getScoreHistory(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 20, 100);

  let query = supabase
    .from('score_snapshots')
    .select('id, listing_id, buyer_id, universe_id, composite_score, geography_score, size_score, service_score, owner_goals_score, deal_quality_score, engagement_score, tier, trigger_type, scoring_version, scored_at')
    .order('scored_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.universe_id) query = query.eq('universe_id', args.universe_id as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return { data: { snapshots: data || [], total: (data || []).length } };
}

async function getInterestSignals(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const days = Number(args.days) || 30;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('interest_signals')
    .select('id, listing_id, user_id, created_at, converted_to_connection, converted_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.converted_only === true) query = query.eq('converted_to_connection', true);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const signals = data || [];
  return {
    data: {
      signals,
      total: signals.length,
      converted: signals.filter(s => s.converted_to_connection).length,
    },
  };
}

async function getBuyerLearningHistory(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 500);
  const action = (args.action as string) || 'all';

  let query = supabase
    .from('buyer_learning_history')
    .select('id, buyer_id, listing_id, universe_id, score_id, action, pass_reason, pass_category, composite_score, geography_score, size_score, service_score, owner_goals_score, score_at_decision, action_by, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.universe_id) query = query.eq('universe_id', args.universe_id as string);
  if (action !== 'all') query = query.eq('action', action);
  if (args.pass_category) query = query.eq('pass_category', args.pass_category as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const records = data || [];
  const byAction: Record<string, number> = {};
  const byPassCategory: Record<string, number> = {};
  for (const r of records) {
    byAction[r.action] = (byAction[r.action] || 0) + 1;
    if (r.pass_category) byPassCategory[r.pass_category] = (byPassCategory[r.pass_category] || 0) + 1;
  }

  return {
    data: {
      history: records,
      total: records.length,
      by_action: byAction,
      pass_by_category: byPassCategory,
    },
  };
}
