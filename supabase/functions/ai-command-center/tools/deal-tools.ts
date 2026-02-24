/**
 * Deal Pipeline Tools
 * Query, search, and inspect deals (listings) in the pipeline.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- US State code/name mapping ----------

const STATE_CODE_TO_NAME: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
  IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
  MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
  WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',
};

// Simple fuzzy match: checks if target contains a close match to query (1 edit distance tolerance)
function fuzzyContains(target: string, query: string): boolean {
  if (target.includes(query)) return true;
  if (query.length < 4) return false;
  // Check each substring of target for edit distance <= 1
  for (let i = 0; i <= target.length - query.length + 1; i++) {
    const sub = target.substring(i, i + query.length);
    let dist = 0;
    for (let j = 0; j < query.length; j++) {
      if (sub[j] !== query[j]) dist++;
      if (dist > 1) break;
    }
    if (dist <= 1) return true;
  }
  return false;
}

// ---------- Quick vs Full field sets ----------

const DEAL_FIELDS_QUICK = `
  id, title, status, status_label, deal_source, industry, revenue, ebitda,
  location, address_state, geographic_states, services,
  deal_total_score, is_priority_target, remarketing_status,
  deal_owner_id, primary_owner_id, updated_at
`.replace(/\s+/g, ' ').trim();

const DEAL_FIELDS_FULL = `
  id, title, status, status_label, status_tag, deal_source, industry, industry_tier_name,
  revenue, ebitda, ebitda_margin,
  location, address_city, address_state, address_zip, geographic_states,
  services, service_mix, business_model, categories,
  full_time_employees, number_of_locations,
  deal_total_score, deal_size_score, revenue_score, ebitda_score,
  is_priority_target, remarketing_status, enrichment_status,
  executive_summary, investment_thesis, key_risks, growth_drivers,
  owner_goals, seller_motivation, timeline_preference, transition_preferences,
  competitive_position, management_depth, customer_concentration,
  internal_company_name, project_name, deal_identifier,
  deal_owner_id, primary_owner_id, presented_by_admin_id,
  need_buyer_universe, universe_build_flagged,
  created_at, updated_at, enriched_at, published_at
`.replace(/\s+/g, ' ').trim();

// ---------- Tool definitions ----------

export const dealTools: ClaudeTool[] = [
  {
    name: 'query_deals',
    description: 'Search and filter deals in the pipeline. Supports filtering by status, source, geography, industry, revenue range, and text search. Returns a list of matching deals sorted by relevance.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by deal status (e.g. "active", "closed", "pipeline")' },
        deal_source: { type: 'string', description: 'Filter by source (e.g. "captarget", "go_partners", "marketplace", "internal")' },
        state: { type: 'string', description: 'Filter by US state code (e.g. "TX", "CA")' },
        industry: { type: 'string', description: 'Filter by industry keyword' },
        min_revenue: { type: 'number', description: 'Minimum revenue filter' },
        max_revenue: { type: 'number', description: 'Maximum revenue filter' },
        min_ebitda: { type: 'number', description: 'Minimum EBITDA filter' },
        search: { type: 'string', description: 'Free-text search across title, description, services, location' },
        is_priority: { type: 'boolean', description: 'Filter to priority targets only' },
        limit: { type: 'number', description: 'Max results (default 25 for simple queries, auto-expands for search/industry filters to scan all matching deals)' },
        depth: { type: 'string', enum: ['quick', 'full'], description: 'quick = summary fields, full = all details' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_details',
    description: 'Get comprehensive details for a specific deal by ID. Includes financials, geography, services, scores, owner goals, risks, and investment thesis.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'get_deal_activities',
    description: 'Get recent activity log for a deal — notes, stage changes, outreach events, etc.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        limit: { type: 'number', description: 'Max activities to return (default 20)' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'get_deal_tasks',
    description: 'Get tasks/to-dos for a deal, optionally filtered by status or assignee.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'all'], description: 'Filter by task status (default "all")' },
        assigned_to: { type: 'string', description: 'Filter by assigned user ID. Use "CURRENT_USER" for the current user.' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a high-level summary of the deal pipeline — counts by status, source, stage, and key metrics.',
    input_schema: {
      type: 'object',
      properties: {
        group_by: { type: 'string', enum: ['status', 'deal_source', 'industry', 'address_state'], description: 'Dimension to group by (default "status")' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeDealTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'query_deals': return queryDeals(supabase, args);
    case 'get_deal_details': return getDealDetails(supabase, args);
    case 'get_deal_activities': return getDealActivities(supabase, args);
    case 'get_deal_tasks': return getDealTasks(supabase, args);
    case 'get_pipeline_summary': return getPipelineSummary(supabase, args);
    default: return { error: `Unknown deal tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function queryDeals(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const depth = (args.depth as string) || 'quick';
  const needsClientFilter = !!(args.search || args.industry || args.state);
  // When client-side filtering is needed, fetch all matching rows via pagination
  const requestedLimit = Number(args.limit) || (needsClientFilter ? 5000 : 25);
  const fields = depth === 'full' ? DEAL_FIELDS_FULL : DEAL_FIELDS_QUICK;

  // Build base query filters
  const buildQuery = (offset: number, batchSize: number) => {
    let query = supabase
      .from('listings')
      .select(fields)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (args.status) query = query.eq('status', args.status as string);
    if (args.deal_source) query = query.eq('deal_source', args.deal_source as string);
    // State filter is now client-side to check both address_state (full names) and geographic_states (codes)
    if (args.is_priority === true) query = query.eq('is_priority_target', true);
    if (args.min_revenue) query = query.gte('revenue', args.min_revenue as number);
    if (args.max_revenue) query = query.lte('revenue', args.max_revenue as number);
    if (args.min_ebitda) query = query.gte('ebitda', args.min_ebitda as number);
    return query;
  };

  // Paginate to fetch all rows up to requestedLimit
  const PAGE_SIZE = 1000;
  let allData: typeof data = [];
  let offset = 0;
  let data: Record<string, unknown>[] | null = null;

  while (offset < requestedLimit) {
    const batchSize = Math.min(PAGE_SIZE, requestedLimit - offset);
    const { data: batch, error } = await buildQuery(offset, batchSize);
    if (error) return { error: error.message };
    if (!batch || batch.length === 0) break;
    allData = allData.concat(batch);
    if (batch.length < batchSize) break; // last page
    offset += batch.length;
  }

  let results = allData;

  // Client-side state filter — checks both address_state (full names like "Ohio") and geographic_states (codes like "OH")
  if (args.state) {
    const stateCode = (args.state as string).toUpperCase();
    const stateName = STATE_CODE_TO_NAME[stateCode] || stateCode;
    const stateCodeLower = stateCode.toLowerCase();
    const stateNameLower = stateName.toLowerCase();
    results = results.filter((d: Record<string, unknown>) => {
      const addrState = ((d.address_state as string) || '').toLowerCase();
      const geoStates = (d.geographic_states as string[]) || [];
      return (
        addrState === stateCodeLower ||
        addrState === stateNameLower ||
        geoStates.some((s: string) => s.toUpperCase() === stateCode)
      );
    });
  }

  // Client-side text search with fuzzy matching
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter((d: Record<string, unknown>) => {
      const title = (d.title as string)?.toLowerCase() || '';
      const industry = (d.industry as string)?.toLowerCase() || '';
      const location = (d.location as string)?.toLowerCase() || '';
      const internalName = (d.internal_company_name as string)?.toLowerCase() || '';
      const projectName = (d.project_name as string)?.toLowerCase() || '';
      const services = (d.services as string[]) || [];

      // Exact substring match
      if (
        title.includes(term) || industry.includes(term) || location.includes(term) ||
        internalName.includes(term) || projectName.includes(term) ||
        services.some((s: string) => s.toLowerCase().includes(term))
      ) return true;

      // Fuzzy match: check if all words in the search appear in the combined text
      const combined = `${title} ${internalName} ${projectName} ${industry} ${location} ${services.join(' ')}`;
      const words = term.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 1 && words.every(w => fuzzyContains(combined, w))) return true;

      // Single-word fuzzy (edit distance) for entity names
      if (term.length >= 4 && (fuzzyContains(title, term) || fuzzyContains(internalName, term) || fuzzyContains(projectName, term))) return true;

      return false;
    });
  }

  // Client-side industry keyword filter
  if (args.industry) {
    const term = (args.industry as string).toLowerCase();
    results = results.filter((d: Record<string, unknown>) =>
      (d.industry as string)?.toLowerCase().includes(term) ||
      (d.services as string[])?.some((s: string) => s.toLowerCase().includes(term))
    );
  }

  return {
    data: {
      deals: results,
      total: results.length,
      depth,
      state_filter: args.state || null,
    },
  };
}

async function getDealDetails(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;

  // Parallel fetch: deal + tasks + activities + scores
  const [dealResult, tasksResult, activitiesResult, scoresResult] = await Promise.all([
    supabase.from('listings').select(DEAL_FIELDS_FULL).eq('id', dealId).single(),
    supabase.from('deal_tasks').select('id, title, status, priority, due_date, assigned_to, completed_at')
      .eq('deal_id', dealId).order('created_at', { ascending: false }).limit(10),
    supabase.from('deal_activities').select('id, title, activity_type, description, created_at')
      .eq('deal_id', dealId).order('created_at', { ascending: false }).limit(5),
    supabase.from('remarketing_scores').select('buyer_id, composite_score, status, tier')
      .eq('listing_id', dealId).order('composite_score', { ascending: false }).limit(5),
  ]);

  if (dealResult.error) return { error: dealResult.error.message };

  return {
    data: {
      deal: dealResult.data,
      recent_tasks: tasksResult.data || [],
      recent_activities: activitiesResult.data || [],
      top_buyer_scores: scoresResult.data || [],
    },
  };
}

async function getDealActivities(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const limit = Math.min(Number(args.limit) || 20, 50);

  const { data, error } = await supabase
    .from('deal_activities')
    .select('id, title, activity_type, description, metadata, admin_id, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };
  return { data: { activities: data || [], total: (data || []).length } };
}

async function getDealTasks(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const status = (args.status as string) || 'all';

  let query = supabase
    .from('deal_tasks')
    .select('id, title, description, status, priority, due_date, assigned_to, assigned_by, completed_at, completed_by, created_at, updated_at')
    .eq('deal_id', dealId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (status !== 'all') query = query.eq('status', status);
  if (args.assigned_to) query = query.eq('assigned_to', args.assigned_to as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // Group by status for easier consumption
  const tasks = data || [];
  const grouped = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return {
    data: {
      tasks,
      total: tasks.length,
      by_status: { pending: grouped.pending.length, in_progress: grouped.in_progress.length, completed: grouped.completed.length },
      overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length,
    },
  };
}

async function getPipelineSummary(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const groupBy = (args.group_by as string) || 'status';

  // Fetch all active deals with summary fields
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, deal_source, industry, address_state, revenue, ebitda, deal_total_score, is_priority_target, remarketing_status')
    .is('deleted_at', null);

  if (error) return { error: error.message };
  const deals = data || [];

  // Aggregate by requested dimension
  const groups: Record<string, { count: number; total_revenue: number; total_ebitda: number; avg_score: number; deal_ids: string[] }> = {};

  for (const deal of deals) {
    const key = (deal[groupBy as keyof typeof deal] as string) || 'unknown';
    if (!groups[key]) groups[key] = { count: 0, total_revenue: 0, total_ebitda: 0, avg_score: 0, deal_ids: [] };
    groups[key].count++;
    groups[key].total_revenue += deal.revenue || 0;
    groups[key].total_ebitda += deal.ebitda || 0;
    groups[key].avg_score += deal.deal_total_score || 0;
    groups[key].deal_ids.push(deal.id);
  }

  // Calculate averages
  for (const g of Object.values(groups)) {
    g.avg_score = g.count > 0 ? Math.round(g.avg_score / g.count) : 0;
  }

  return {
    data: {
      total_deals: deals.length,
      priority_deals: deals.filter(d => d.is_priority_target).length,
      grouped_by: groupBy,
      groups,
    },
  };
}
