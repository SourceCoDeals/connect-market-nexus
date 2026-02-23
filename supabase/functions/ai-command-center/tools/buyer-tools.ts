/**
 * Buyer Intelligence Tools
 * Search, profile, and analyze remarketing buyers.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClaudeTool } from "../../_shared/claude-client.ts";
import type { ToolResult } from "./index.ts";

// ---------- Field sets ----------

const BUYER_FIELDS_QUICK = `
  id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
  geographic_footprint, target_services, target_revenue_min, target_revenue_max,
  acquisition_appetite, alignment_score, has_fee_agreement, data_completeness,
  num_employees, number_of_locations, total_acquisitions, archived
`.replace(/\s+/g, ' ').trim();

const BUYER_FIELDS_FULL = `
  id, company_name, pe_firm_name, buyer_type, business_type,
  hq_city, hq_state, hq_region, hq_country,
  geographic_footprint, operating_locations, service_regions,
  target_services, services_offered, target_industries, industry_vertical,
  target_revenue_min, target_revenue_max, target_ebitda_min, target_ebitda_max,
  target_geographies, target_customer_profile,
  acquisition_appetite, acquisition_frequency, acquisition_timeline,
  alignment_score, alignment_reasoning, alignment_checked_at,
  thesis_summary, thesis_confidence,
  has_fee_agreement, fee_agreement_status, fee_agreement_source,
  data_completeness, confidence_level,
  num_employees, num_platforms, number_of_locations,
  total_acquisitions, recent_acquisitions, platform_acquisitions, pe_firm_acquisitions,
  business_summary, notes, revenue_model, customer_geographic_reach,
  company_website, platform_website, pe_firm_website,
  buyer_linkedin, pe_firm_linkedin,
  universe_id, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// ---------- Tool definitions ----------

export const buyerTools: ClaudeTool[] = [
  {
    name: 'search_buyers',
    description: 'Search remarketing buyers by criteria — geography, type, services, revenue range, acquisition appetite, fee agreement status, and free text. Returns buyer summaries sorted by alignment score.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free-text search across company name, PE firm, services, geography' },
        buyer_type: { type: 'string', description: 'Filter by buyer type (e.g. "pe_platform", "strategic", "independent_sponsor")' },
        state: { type: 'string', description: 'Filter by HQ state or geographic footprint state code (e.g. "TX")' },
        services: {
          type: 'array', items: { type: 'string' },
          description: 'Filter by target service keywords',
        },
        min_revenue: { type: 'number', description: 'Minimum target revenue' },
        max_revenue: { type: 'number', description: 'Maximum target revenue' },
        has_fee_agreement: { type: 'boolean', description: 'Filter by fee agreement status' },
        acquisition_appetite: { type: 'string', description: 'Filter by appetite (e.g. "aggressive", "active", "selective")' },
        include_archived: { type: 'boolean', description: 'Include archived buyers (default false)' },
        limit: { type: 'number', description: 'Max results (default 25, max 100)' },
        depth: { type: 'string', enum: ['quick', 'full'], description: 'quick = summary, full = all details' },
      },
      required: [],
    },
  },
  {
    name: 'get_buyer_profile',
    description: 'Get comprehensive profile for a specific buyer — company details, acquisition criteria, thesis, history, contacts, and deal scores.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'The remarketing buyer UUID' },
      },
      required: ['buyer_id'],
    },
  },
  {
    name: 'get_score_breakdown',
    description: 'Get the detailed scoring breakdown between a specific buyer and deal — composite score, geography, service, size, and owner goals dimensions.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string', description: 'The remarketing buyer UUID' },
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
      },
      required: ['buyer_id', 'deal_id'],
    },
  },
  {
    name: 'get_top_buyers_for_deal',
    description: 'Get the top-ranked buyers for a specific deal, sorted by composite score. Includes score breakdown and status.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        status: { type: 'string', description: 'Filter by score status (e.g. "approved", "pending", "passed")' },
        min_score: { type: 'number', description: 'Minimum composite score threshold' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'search_lead_sources',
    description: 'Search deals by lead source type — CP Targets, GO Partners, marketplace, internal. Groups deals by their origin for pipeline analysis.',
    input_schema: {
      type: 'object',
      properties: {
        source_type: { type: 'string', enum: ['captarget', 'go_partners', 'marketplace', 'internal', 'all'], description: 'Which lead source to query' },
        status: { type: 'string', description: 'Filter by deal status' },
        limit: { type: 'number', description: 'Max results (default 25)' },
      },
      required: [],
    },
  },
];

// ---------- Executor ----------

export async function executeBuyerTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'search_buyers': return searchBuyers(supabase, args);
    case 'get_buyer_profile': return getBuyerProfile(supabase, args);
    case 'get_score_breakdown': return getScoreBreakdown(supabase, args);
    case 'get_top_buyers_for_deal': return getTopBuyersForDeal(supabase, args);
    case 'search_lead_sources': return searchLeadSources(supabase, args);
    default: return { error: `Unknown buyer tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function searchBuyers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const depth = (args.depth as string) || 'quick';
  const limit = Math.min(Number(args.limit) || 25, 100);
  const fields = depth === 'full' ? BUYER_FIELDS_FULL : BUYER_FIELDS_QUICK;

  let query = supabase
    .from('remarketing_buyers')
    .select(fields)
    .order('alignment_score', { ascending: false, nullsFirst: false })
    .limit(limit);

  // Archived filter (default: exclude archived)
  if (args.include_archived !== true) {
    query = query.eq('archived', false);
  }

  if (args.buyer_type) query = query.eq('buyer_type', args.buyer_type as string);
  if (args.has_fee_agreement !== undefined) query = query.eq('has_fee_agreement', args.has_fee_agreement as boolean);
  if (args.acquisition_appetite) query = query.eq('acquisition_appetite', args.acquisition_appetite as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Client-side geographic filter (checks hq_state OR geographic_footprint array)
  if (args.state) {
    const st = (args.state as string).toUpperCase();
    results = results.filter(b =>
      b.hq_state?.toUpperCase() === st ||
      b.geographic_footprint?.some((g: string) => g.toUpperCase() === st)
    );
  }

  // Client-side service filter
  if (args.services && (args.services as string[]).length > 0) {
    const svcTerms = (args.services as string[]).map(s => s.toLowerCase());
    results = results.filter(b =>
      b.target_services?.some((ts: string) =>
        svcTerms.some(term => ts.toLowerCase().includes(term))
      )
    );
  }

  // Client-side revenue range filter
  if (args.min_revenue) {
    const min = args.min_revenue as number;
    results = results.filter(b => !b.target_revenue_max || b.target_revenue_max >= min);
  }
  if (args.max_revenue) {
    const max = args.max_revenue as number;
    results = results.filter(b => !b.target_revenue_min || b.target_revenue_min <= max);
  }

  // Client-side free-text search
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(b =>
      b.company_name?.toLowerCase().includes(term) ||
      b.pe_firm_name?.toLowerCase().includes(term) ||
      b.target_services?.some((s: string) => s.toLowerCase().includes(term)) ||
      b.hq_state?.toLowerCase().includes(term) ||
      b.hq_city?.toLowerCase().includes(term) ||
      b.geographic_footprint?.some((g: string) => g.toLowerCase().includes(term))
    );
  }

  return {
    data: {
      buyers: results,
      total: results.length,
      depth,
    },
  };
}

async function getBuyerProfile(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const buyerId = args.buyer_id as string;

  // Parallel fetch: buyer + contacts + scores + transcripts
  const [buyerResult, contactsResult, scoresResult, transcriptsResult] = await Promise.all([
    supabase.from('remarketing_buyers').select(BUYER_FIELDS_FULL).eq('id', buyerId).single(),
    supabase.from('buyer_contacts').select('*').eq('buyer_id', buyerId).order('is_primary_contact', { ascending: false }),
    supabase.from('remarketing_scores').select('listing_id, composite_score, status, tier, geography_score, service_score, size_score, owner_goals_score, fit_reasoning')
      .eq('buyer_id', buyerId).order('composite_score', { ascending: false }).limit(10),
    supabase.from('call_transcripts').select('id, created_at, call_type, ceo_detected, key_quotes, extracted_insights')
      .eq('buyer_id', buyerId).order('created_at', { ascending: false }).limit(5),
  ]);

  if (buyerResult.error) return { error: buyerResult.error.message };

  return {
    data: {
      buyer: buyerResult.data,
      contacts: contactsResult.data || [],
      deal_scores: scoresResult.data || [],
      recent_transcripts: transcriptsResult.data || [],
    },
  };
}

async function getScoreBreakdown(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('remarketing_scores')
    .select('*')
    .eq('buyer_id', args.buyer_id as string)
    .eq('listing_id', args.deal_id as string)
    .single();

  if (error) return { error: error.message };
  return { data: { score: data } };
}

async function getTopBuyersForDeal(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const dealId = args.deal_id as string;
  const limit = Math.min(Number(args.limit) || 20, 50);

  let query = supabase
    .from('remarketing_scores')
    .select(`
      buyer_id, composite_score, status, tier,
      geography_score, service_score, size_score, owner_goals_score,
      acquisition_score, business_model_score, portfolio_score,
      fit_reasoning, pass_reason, confidence_level
    `)
    .eq('listing_id', dealId)
    .order('composite_score', { ascending: false })
    .limit(limit);

  if (args.status) query = query.eq('status', args.status as string);
  if (args.min_score) query = query.gte('composite_score', args.min_score as number);

  const { data: scores, error: scoresError } = await query;
  if (scoresError) return { error: scoresError.message };

  if (!scores || scores.length === 0) {
    return { data: { buyers: [], total: 0 } };
  }

  // Fetch buyer names for the scored buyer IDs
  const buyerIds = scores.map(s => s.buyer_id);
  const { data: buyers } = await supabase
    .from('remarketing_buyers')
    .select('id, company_name, pe_firm_name, buyer_type, hq_state, has_fee_agreement')
    .in('id', buyerIds);

  const buyerMap = new Map((buyers || []).map(b => [b.id, b]));

  const enriched = scores.map(s => ({
    ...s,
    buyer: buyerMap.get(s.buyer_id) || null,
  }));

  return {
    data: {
      buyers: enriched,
      total: enriched.length,
      deal_id: dealId,
    },
  };
}

async function searchLeadSources(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const sourceType = (args.source_type as string) || 'all';
  const limit = Math.min(Number(args.limit) || 25, 100);

  let query = supabase
    .from('listings')
    .select(BUYER_FIELDS_QUICK.replace('archived', 'deal_source'))  // reuse compact fields adapted
    .is('deleted_at', null)
    .order('deal_total_score', { ascending: false, nullsFirst: false })
    .limit(limit);

  // Map source type to deal_source values
  if (sourceType !== 'all') {
    const sourceMap: Record<string, string[]> = {
      captarget: ['captarget', 'cp_target'],
      go_partners: ['go_partners', 'go-partners'],
      marketplace: ['marketplace'],
      internal: ['internal', 'direct'],
    };
    const sources = sourceMap[sourceType] || [sourceType];
    query = query.in('deal_source', sources);
  }

  if (args.status) query = query.eq('status', args.status as string);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // Also provide source breakdown
  const deals = data || [];
  const sourceBreakdown: Record<string, number> = {};
  for (const d of deals) {
    const src = (d as Record<string, unknown>).deal_source as string || 'unknown';
    sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
  }

  return {
    data: {
      deals,
      total: deals.length,
      source_breakdown: sourceBreakdown,
    },
  };
}
