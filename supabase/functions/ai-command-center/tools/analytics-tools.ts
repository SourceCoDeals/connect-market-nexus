/**
 * Pipeline Analytics Tools
 * Aggregated metrics and analytics across the deal pipeline.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const analyticsTools: ClaudeTool[] = [
  {
    name: 'get_enrichment_status',
    description: 'Get enrichment job status and queue — check if buyer or deal enrichment jobs are running, pending, or failed. Shows progress, error counts, and records processed. Also checks the buyer enrichment queue.',
    input_schema: {
      type: 'object',
      properties: {
        job_type: { type: 'string', enum: ['deal_enrichment', 'buyer_enrichment', 'all'], description: 'Filter by job type (default "all")' },
        status: { type: 'string', description: 'Filter by job status: pending, processing, completed, failed, paused, cancelled' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_industry_trackers',
    description: 'Get industry trackers — named industry verticals that group deals and buyers together with custom scoring weights. Each tracker is linked to a buyer universe and shows deal count, buyer count, and scoring configuration (geography/size/service weights). Use to understand which industries SourceCo tracks and their scoring setup.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Search by tracker name or description' },
        universe_id: { type: 'string', description: 'Filter by associated buyer universe UUID' },
        active_only: { type: 'boolean', description: 'Only show active (non-archived) trackers (default true)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_analytics',
    description: 'Get pipeline analytics — deal counts, revenue totals, conversion rates, scoring distributions, and time-based trends. Use for dashboards, reports, and pipeline health checks.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['pipeline_health', 'scoring_distribution', 'source_performance', 'activity_summary', 'buyer_engagement'],
          description: 'Which analytics view to return',
        },
        days: { type: 'number', description: 'Lookback period in days (default 30)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeAnalyticsTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_enrichment_status': return getEnrichmentStatus(supabase, args);
    case 'get_industry_trackers': return getIndustryTrackers(supabase, args);
    case 'get_analytics': return getAnalytics(supabase, args);
    default: return { error: `Unknown analytics tool: ${toolName}` };
  }
}

async function getIndustryTrackers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 200);

  let query = supabase
    .from('industry_trackers')
    .select('id, name, description, universe_id, deal_count, buyer_count, color, is_active, archived, geography_weight, service_mix_weight, size_weight, owner_goals_weight, geography_mode, size_criteria, service_criteria, geography_criteria, created_at, updated_at')
    .order('deal_count', { ascending: false })
    .limit(limit);

  if (args.active_only !== false) query = query.eq('archived', false);
  if (args.universe_id) query = query.eq('universe_id', args.universe_id as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(t =>
      t.name?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term)
    );
  }

  return {
    data: {
      trackers: results,
      total: results.length,
      total_deals: results.reduce((s, t) => s + (t.deal_count || 0), 0),
      total_buyers: results.reduce((s, t) => s + (t.buyer_count || 0), 0),
    },
  };
}

async function getEnrichmentStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 10, 50);
  const jobType = (args.job_type as string) || 'all';

  let jobQuery = supabase
    .from('enrichment_jobs')
    .select('id, job_type, status, total_records, records_processed, records_succeeded, records_failed, records_skipped, error_summary, error_count, circuit_breaker_tripped, started_at, completed_at, created_at, triggered_by, source')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (jobType !== 'all') jobQuery = jobQuery.eq('job_type', jobType);
  if (args.status) jobQuery = jobQuery.eq('status', args.status as string);

  const [jobsResult, queueResult] = await Promise.all([
    jobQuery,
    supabase
      .from('buyer_enrichment_queue')
      .select('id, buyer_id, universe_id, status, attempts, queued_at, completed_at, last_error, created_at')
      .order('queued_at', { ascending: false })
      .limit(50),
  ]);

  if (jobsResult.error) return { error: jobsResult.error.message };

  const jobs = jobsResult.data || [];
  const queue = queueResult.data || [];

  const queueByStatus: Record<string, number> = {};
  for (const q of queue) {
    queueByStatus[q.status] = (queueByStatus[q.status] || 0) + 1;
  }

  return {
    data: {
      jobs,
      total_jobs: jobs.length,
      buyer_enrichment_queue: {
        items: queue,
        total: queue.length,
        by_status: queueByStatus,
      },
    },
  };
}

// ---------- Implementations ----------

async function getAnalytics(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const metric = (args.metric as string) || 'pipeline_health';
  const days = Number(args.days) || 30;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  switch (metric) {
    case 'pipeline_health':
      return pipelineHealth(supabase);
    case 'scoring_distribution':
      return scoringDistribution(supabase);
    case 'source_performance':
      return sourcePerformance(supabase);
    case 'activity_summary':
      return activitySummary(supabase, cutoffDate);
    case 'buyer_engagement':
      return buyerEngagement(supabase, cutoffDate);
    default:
      return pipelineHealth(supabase);
  }
}

async function pipelineHealth(supabase: SupabaseClient): Promise<ToolResult> {
  const { data: deals, error } = await supabase
    .from('listings')
    .select('id, status, revenue, ebitda, deal_total_score, is_priority_target, deal_source, remarketing_status, created_at')
    .is('deleted_at', null);

  if (error) return { error: error.message };
  const d = deals || [];

  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;
  let totalEbitda = 0;
  let scoredCount = 0;
  let scoreSum = 0;

  for (const deal of d) {
    byStatus[deal.status] = (byStatus[deal.status] || 0) + 1;
    totalRevenue += deal.revenue || 0;
    totalEbitda += deal.ebitda || 0;
    if (deal.deal_total_score) { scoredCount++; scoreSum += deal.deal_total_score; }
  }

  return {
    data: {
      metric: 'pipeline_health',
      total_deals: d.length,
      by_status: byStatus,
      priority_count: d.filter(x => x.is_priority_target).length,
      total_revenue: totalRevenue,
      total_ebitda: totalEbitda,
      avg_deal_score: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
      by_source: d.reduce((acc: Record<string, number>, x) => {
        const src = x.deal_source || 'unknown';
        acc[src] = (acc[src] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

async function scoringDistribution(supabase: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('remarketing_scores')
    .select('composite_score, status, tier')
    .order('composite_score', { ascending: false })
    .limit(500);

  if (error) return { error: error.message };
  const scores = data || [];

  const byStatus: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const ranges = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, 'below_50': 0 };

  for (const s of scores) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    if (s.tier) byTier[s.tier] = (byTier[s.tier] || 0) + 1;

    const score = s.composite_score;
    if (score >= 90) ranges['90-100']++;
    else if (score >= 80) ranges['80-89']++;
    else if (score >= 70) ranges['70-79']++;
    else if (score >= 60) ranges['60-69']++;
    else if (score >= 50) ranges['50-59']++;
    else ranges['below_50']++;
  }

  return {
    data: {
      metric: 'scoring_distribution',
      total_scores: scores.length,
      by_status: byStatus,
      by_tier: byTier,
      score_ranges: ranges,
      avg_score: scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.composite_score, 0) / scores.length) : null,
    },
  };
}

async function sourcePerformance(supabase: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('listings')
    .select('deal_source, status, revenue, ebitda, deal_total_score, is_priority_target')
    .is('deleted_at', null);

  if (error) return { error: error.message };
  const deals = data || [];

  const sources: Record<string, { count: number; active: number; revenue: number; avg_score: number; priority: number }> = {};

  for (const d of deals) {
    const src = d.deal_source || 'unknown';
    if (!sources[src]) sources[src] = { count: 0, active: 0, revenue: 0, avg_score: 0, priority: 0 };
    sources[src].count++;
    if (d.status === 'active') sources[src].active++;
    sources[src].revenue += d.revenue || 0;
    sources[src].avg_score += d.deal_total_score || 0;
    if (d.is_priority_target) sources[src].priority++;
  }

  for (const s of Object.values(sources)) {
    s.avg_score = s.count > 0 ? Math.round(s.avg_score / s.count) : 0;
  }

  return {
    data: { metric: 'source_performance', sources },
  };
}

async function activitySummary(supabase: SupabaseClient, cutoffDate: string): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('deal_activities')
    .select('activity_type, deal_id, created_at')
    .gte('created_at', cutoffDate);

  if (error) return { error: error.message };
  const activities = data || [];

  const byType: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const a of activities) {
    byType[a.activity_type] = (byType[a.activity_type] || 0) + 1;
    const day = a.created_at?.substring(0, 10) || 'unknown';
    byDay[day] = (byDay[day] || 0) + 1;
  }

  return {
    data: {
      metric: 'activity_summary',
      total_activities: activities.length,
      unique_deals: new Set(activities.map(a => a.deal_id)).size,
      by_type: byType,
      by_day: byDay,
    },
  };
}

async function buyerEngagement(supabase: SupabaseClient, cutoffDate: string): Promise<ToolResult> {
  const [accessResult, scoresResult] = await Promise.all([
    supabase
      .from('deal_data_room_access')
      .select('buyer_id, buyer_name, deal_id, granted_at, last_accessed_at, is_active, nda_signed_at')
      .gte('granted_at', cutoffDate),
    supabase
      .from('remarketing_scores')
      .select('buyer_id, status, listing_id')
      .gte('updated_at', cutoffDate),
  ]);

  const access = accessResult.data || [];
  const scores = scoresResult.data || [];

  const statusChanges: Record<string, number> = {};
  for (const s of scores) {
    statusChanges[s.status] = (statusChanges[s.status] || 0) + 1;
  }

  return {
    data: {
      metric: 'buyer_engagement',
      data_room_grants: access.length,
      active_access: access.filter(a => a.is_active).length,
      nda_signed: access.filter(a => a.nda_signed_at).length,
      score_status_changes: statusChanges,
      unique_buyers_engaged: new Set(access.map(a => a.buyer_id)).size,
    },
  };
}
