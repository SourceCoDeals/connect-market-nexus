/**
 * Buyer Universe & Outreach Tools
 * Query buyer universes, outreach records, and deal-universe mappings.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Tool definitions ----------

export const universeTools: ClaudeTool[] = [
  {
    name: 'search_buyer_universes',
    description: 'Search and list buyer universes — the curated buyer lists built for specific industry verticals. Each universe defines fit criteria (geography, size, services), scoring weights, and which deals it applies to. Use to find universes by name or industry.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free-text search across universe name and description' },
        archived: { type: 'boolean', description: 'Include archived universes (default false)' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_universe_details',
    description: 'Get full details for a specific buyer universe — criteria, scoring weights, associated deals, and buyer count.',
    input_schema: {
      type: 'object',
      properties: {
        universe_id: { type: 'string', description: 'The buyer universe UUID' },
      },
      required: ['universe_id'],
    },
  },
  {
    name: 'get_outreach_records',
    description: 'Get outreach tracking records — who was contacted for a deal/buyer, NDA status, meeting history, outcomes, and next actions. Critical for follow-up management. Filter by deal, buyer, outcome, or date.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        universe_id: { type: 'string', description: 'Filter by universe UUID' },
        outcome: { type: 'string', description: 'Filter by outcome: in_progress, won, lost, withdrawn, no_response' },
        has_nda: { type: 'boolean', description: 'Filter to records where NDA was sent' },
        has_meeting: { type: 'boolean', description: 'Filter to records where meeting was scheduled' },
        next_action_overdue: { type: 'boolean', description: 'Filter to records where next_action_date is past due' },
        limit: { type: 'number', description: 'Max results (default 50, use 1000 for full pipeline counts)' },
      },
      required: [],
    },
  },
  {
    name: 'get_remarketing_outreach',
    description: 'Get remarketing outreach status records — outreach campaigns by status (pending, contacted, responded, meeting_scheduled, nda_sent, passed). Use to track buyer contact pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Filter by deal/listing UUID' },
        buyer_id: { type: 'string', description: 'Filter by buyer UUID' },
        status: { type: 'string', description: 'Filter by status: pending, contacted, responded, meeting_scheduled, nda_sent, passed' },
        limit: { type: 'number', description: 'Max results (default 50)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeUniverseTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'search_buyer_universes': return searchBuyerUniverses(supabase, args);
    case 'get_universe_details': return getUniverseDetails(supabase, args);
    case 'get_outreach_records': return getOutreachRecords(supabase, args);
    case 'get_remarketing_outreach': return getRemarketingOutreach(supabase, args);
    default: return { error: `Unknown universe tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function searchBuyerUniverses(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 200);

  let query = supabase
    .from('remarketing_buyer_universes')
    .select('id, name, description, fit_criteria, size_criteria, geography_criteria, service_criteria, buyer_types_criteria, geography_weight, size_weight, service_weight, owner_goals_weight, archived, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (args.archived !== true) query = query.eq('archived', false);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter((u: any) =>
      u.name?.toLowerCase().includes(term) ||
      u.description?.toLowerCase().includes(term) ||
      u.fit_criteria?.toLowerCase().includes(term)
    );
  }

  return { data: { universes: results, total: results.length } };
}

async function getUniverseDetails(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const universeId = args.universe_id as string;

  const [universeResult, dealsResult, buyerCountResult] = await Promise.all([
    supabase
      .from('remarketing_buyer_universes')
      .select('*')
      .eq('id', universeId)
      .single(),
    supabase
      .from('remarketing_universe_deals')
      .select('id, listing_id, status, added_at, notes')
      .eq('universe_id', universeId)
      .eq('status', 'active'),
    supabase
      .from('remarketing_buyers')
      .select('id', { count: 'exact', head: true })
      .eq('universe_id', universeId)
      .eq('archived', false),
  ]);

  if (universeResult.error) return { error: universeResult.error.message };

  return {
    data: {
      universe: universeResult.data,
      associated_deals: dealsResult.data || [],
      buyer_count: buyerCountResult.count || 0,
    },
  };
}

async function getOutreachRecords(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 2000);
  const now = new Date().toISOString();

  let query = supabase
    .from('outreach_records')
    .select('id, listing_id, buyer_id, universe_id, contacted_at, nda_sent_at, nda_signed_at, cim_sent_at, meeting_scheduled_at, outcome, outcome_notes, outcome_at, last_contact_date, next_action, next_action_date, priority, notes, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.universe_id) query = query.eq('universe_id', args.universe_id as string);
  if (args.outcome) query = query.eq('outcome', args.outcome as string);
  if (args.has_nda === true) query = query.not('nda_sent_at', 'is', null);
  if (args.has_meeting === true) query = query.not('meeting_scheduled_at', 'is', null);
  if (args.next_action_overdue === true) query = query.lt('next_action_date', now).not('next_action_date', 'is', null);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const records = data || [];

  // Summary counts
  const byOutcome: Record<string, number> = {};
  let nda_sent = 0, nda_signed = 0, meetings = 0, overdue = 0;
  for (const r of records) {
    const oc = r.outcome || 'in_progress';
    byOutcome[oc] = (byOutcome[oc] || 0) + 1;
    if (r.nda_sent_at) nda_sent++;
    if (r.nda_signed_at) nda_signed++;
    if (r.meeting_scheduled_at) meetings++;
    if (r.next_action_date && new Date(r.next_action_date) < new Date() && r.outcome === 'in_progress') overdue++;
  }

  return {
    data: {
      records,
      total: records.length,
      summary: { by_outcome: byOutcome, nda_sent, nda_signed, meetings_scheduled: meetings, overdue_actions: overdue },
    },
  };
}

async function getRemarketingOutreach(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit) || 50, 1000);

  let query = supabase
    .from('remarketing_outreach')
    .select('id, listing_id, buyer_id, status, contact_method, contacted_at, response_at, meeting_at, notes, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (args.deal_id) query = query.eq('listing_id', args.deal_id as string);
  if (args.buyer_id) query = query.eq('buyer_id', args.buyer_id as string);
  if (args.status) query = query.eq('status', args.status as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const records = data || [];
  const byStatus: Record<string, number> = {};
  for (const r of records) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  return {
    data: { records, total: records.length, by_status: byStatus },
  };
}
