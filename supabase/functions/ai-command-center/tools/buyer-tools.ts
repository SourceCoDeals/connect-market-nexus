/**
 * Buyer Intelligence Tools
 * Search, profile, and analyze remarketing buyers.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import type { ClaudeTool } from '../../_shared/claude-client.ts';
import type { ToolResult } from './index.ts';

// ---------- Field sets ----------

const BUYER_FIELDS_QUICK = `
  id, company_name, pe_firm_name, buyer_type, hq_state, hq_city,
  geographic_footprint, target_services, target_industries, target_revenue_min, target_revenue_max,
  target_ebitda_min, target_ebitda_max, target_geographies,
  acquisition_appetite, alignment_score, has_fee_agreement,
  thesis_summary, business_summary,
  num_employees, number_of_locations, total_acquisitions, archived
`
  .replace(/\s+/g, ' ')
  .trim();

const BUYER_FIELDS_FULL = `
  id, company_name, pe_firm_name, buyer_type, business_type,
  hq_city, hq_state, hq_region, hq_country,
  geographic_footprint, operating_locations, service_regions,
  target_services, services_offered, target_industries, industry_vertical,
  target_revenue_min, target_revenue_max, target_ebitda_min, target_ebitda_max,
  target_geographies, target_customer_profile,
  acquisition_appetite, acquisition_frequency, acquisition_timeline,
  alignment_score, alignment_reasoning, alignment_checked_at,
  thesis_summary,
  has_fee_agreement, fee_agreement_status, fee_agreement_source,
  num_employees, num_platforms, number_of_locations,
  total_acquisitions, recent_acquisitions, platform_acquisitions, pe_firm_acquisitions,
  business_summary, notes, revenue_model, customer_geographic_reach,
  company_website, platform_website, pe_firm_website,
  buyer_linkedin, pe_firm_linkedin,
  universe_id, created_at, updated_at
`
  .replace(/\s+/g, ' ')
  .trim();

// Fields for querying listings (deals/leads) — NOT buyer fields
const LISTING_LEAD_FIELDS = [
  'id', 'title', 'industry', 'category', 'categories', 'services', 'revenue', 'ebitda',
  'location', 'address_state', 'geographic_states',
  'deal_source', 'deal_total_score', 'is_priority_target', 'status',
  'captarget_sheet_tab', 'captarget_interest_type', 'updated_at', 'created_at',
].join(', ');

// ---------- Tool definitions ----------

export const buyerTools: ClaudeTool[] = [
  {
    name: 'search_buyers',
    description:
      'Search remarketing buyers by criteria — geography, type, services, revenue range, acquisition appetite, fee agreement status, and free text. When state is provided, returns ALL buyers in that state (not limited to top results). Returns buyer summaries sorted by alignment score.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free-text search across company name, PE firm, services, geography' },
        buyer_type: { type: 'string', description: 'Filter by buyer type (e.g. "pe_platform", "strategic", "independent_sponsor")' },
        state: { type: 'string', description: 'Filter by HQ state OR geographic footprint state code (e.g. "OK", "TX"). Applied at database level to find ALL matching buyers.' },
        universe_id: { type: 'string', description: 'Filter to a specific buyer universe ID — scopes results to buyers in that universe' },
        industry: { type: 'string', description: 'Filter by industry keyword (searches target_industries, target_services, company_name, and business_summary)' },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by target service keywords',
        },
        min_revenue: { type: 'number', description: 'Minimum target revenue' },
        max_revenue: { type: 'number', description: 'Maximum target revenue' },
        has_fee_agreement: { type: 'boolean', description: 'Filter by fee agreement status' },
        acquisition_appetite: {
          type: 'string',
          description: 'Filter by appetite (e.g. "aggressive", "active", "selective")',
        },
        include_archived: {
          type: 'boolean',
          description: 'Include archived buyers (default false)',
        },
        limit: {
          type: 'number',
          description:
            'Max results (default 25 for general browsing; when state filter is used, default is 1000 to count all matching buyers)',
        },
        depth: {
          type: 'string',
          enum: ['quick', 'full'],
          description: 'quick = summary, full = all details',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_buyer_profile',
    description:
      'Get comprehensive profile for a specific buyer — company details, acquisition criteria, thesis, history, contacts, and deal scores.',
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
    description:
      'Get the detailed scoring breakdown between a specific buyer and deal — composite score, geography, service, size, and owner goals dimensions.',
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
    description:
      'Get buyers scored for a specific deal (its buyer universe), sorted by composite score. Use this to answer questions like "how many buyers in the [deal name] universe are in [state]". Supports filtering by state and high limits for counting.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The deal/listing UUID' },
        state: {
          type: 'string',
          description:
            'Filter buyers by state code (HQ or geographic footprint) — e.g. "OK" for Oklahoma. Use this for geographic count questions.',
        },
        status: {
          type: 'string',
          description: 'Filter by score status (e.g. "approved", "pending", "passed")',
        },
        min_score: { type: 'number', description: 'Minimum composite score threshold' },
        limit: {
          type: 'number',
          description:
            'Max results (default 20 for top buyers, use 1000+ to count all buyers in the universe)',
        },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'search_lead_sources',
    description:
      'Search deals/leads by lead source type — CP Targets (captarget), GO Partners, marketplace, internal. Returns deal/listing records with industry, revenue, and status. Use this to answer questions like "how many captarget leads are HVAC companies". Supports industry keyword filtering.',
    input_schema: {
      type: 'object',
      properties: {
        source_type: {
          type: 'string',
          enum: ['captarget', 'go_partners', 'marketplace', 'internal', 'all'],
          description: 'Which lead source to query',
        },
        industry: {
          type: 'string',
          description:
            'Filter by industry keyword (e.g. "hvac", "collision", "plumbing", "auto shop", "landscaping")',
        },
        status: { type: 'string', description: 'Filter by deal status' },
        limit: { type: 'number', description: 'Max results (default 5000 for counts)' },
      },
      required: [],
    },
  },
  {
    name: 'search_valuation_leads',
    description:
      'Search valuation calculator leads — business owners who used SourceCo valuation tools (HVAC calculator, collision calculator, auto shop calculator, general calculator). These are high-intent seller leads with self-reported financials. Use for questions about specific calculator lead types.',
    input_schema: {
      type: 'object',
      properties: {
        calculator_type: {
          type: 'string',
          enum: ['general', 'auto_shop', 'hvac', 'collision', 'all'],
          description:
            'Filter by calculator type. "hvac" for HVAC companies, "collision" for collision/auto body, "auto_shop" for auto repair, "general" for general calculator.',
        },
        status: {
          type: 'string',
          description: 'Filter by lead status (e.g. "new", "contacted", "qualified")',
        },
        include_excluded: {
          type: 'boolean',
          description: 'Include excluded leads (default false)',
        },
        pushed_to_deals: {
          type: 'boolean',
          description: 'Filter by whether lead was pushed to All Deals',
        },
        min_revenue: { type: 'number', description: 'Minimum reported revenue' },
        limit: { type: 'number', description: 'Max results (default 5000 for counts)' },
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
    case 'search_buyers':
      return searchBuyers(supabase, args);
    case 'get_buyer_profile':
      return getBuyerProfile(supabase, args);
    case 'get_score_breakdown':
      return getScoreBreakdown(supabase, args);
    case 'get_top_buyers_for_deal':
      return getTopBuyersForDeal(supabase, args);
    case 'search_lead_sources':
      return searchLeadSources(supabase, args);
    case 'search_valuation_leads':
      return searchValuationLeads(supabase, args);
    default:
      return { error: `Unknown buyer tool: ${toolName}` };
  }
}

// ---------- Implementations ----------

async function searchBuyers(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const depth = (args.depth as string) || 'quick';

  // When filtering by state, universe, search text, services, or industry, we need a much higher limit
  // to ensure client-side filtering has enough data to find all matches
  const hasSelectiveFilter = !!(args.state || args.universe_id || args.search || args.services || args.industry);

  // Always use FULL fields when client-side filtering is active so we can search
  // across ALL buyer data points (target_industries, thesis_summary, business_summary, etc.)
  const fields = (hasSelectiveFilter || depth === 'full') ? BUYER_FIELDS_FULL : BUYER_FIELDS_QUICK;
  const limit = hasSelectiveFilter
    ? Math.min(Number(args.limit) || 1000, 5000)
    : Math.min(Number(args.limit) || 25, 100);

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
  if (args.has_fee_agreement !== undefined)
    query = query.eq('has_fee_agreement', args.has_fee_agreement as boolean);
  if (args.acquisition_appetite)
    query = query.eq('acquisition_appetite', args.acquisition_appetite as string);
  if (args.universe_id) query = query.eq('universe_id', args.universe_id as string);

  // Apply state filter at DB level (checks hq_state OR geographic_footprint array)
  // This ensures ALL matching buyers are returned, not just the top N by score
  if (args.state) {
    const st = (args.state as string).toUpperCase();
    query = query.or(`hq_state.eq.${st},geographic_footprint.cs.{${st}}`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  let results = data || [];

  // Helper: safely check if a field (which may be string or array) contains a term
  const fieldContains = (field: unknown, term: string): boolean => {
    if (!field) return false;
    if (Array.isArray(field))
      return field.some((v: string) => String(v).toLowerCase().includes(term));
    if (typeof field === 'string') return field.toLowerCase().includes(term);
    return false;
  };

  // Client-side service filter
  if (args.services && (args.services as string[]).length > 0) {
    const svcTerms = (args.services as string[]).map((s) => s.toLowerCase());
    results = results.filter((b: any) =>
      svcTerms.some(
        (term) => fieldContains(b.target_services, term) || fieldContains(b.services_offered, term),
      ),
    );
  }

  // Client-side revenue range filter
  if (args.min_revenue) {
    const min = args.min_revenue as number;
    results = results.filter((b: any) => !b.target_revenue_max || b.target_revenue_max >= min);
  }
  if (args.max_revenue) {
    const max = args.max_revenue as number;
    results = results.filter((b: any) => !b.target_revenue_min || b.target_revenue_min <= max);
  }

  // Client-side industry keyword filter — searches ALL relevant buyer fields
  if (args.industry) {
    const term = (args.industry as string).toLowerCase();
    results = results.filter((b: any) =>
      b.target_industries?.some((i: string) => i.toLowerCase().includes(term)) ||
      b.target_services?.some((s: string) => s.toLowerCase().includes(term)) ||
      b.services_offered?.some((s: string) => s.toLowerCase().includes(term)) ||
      b.industry_vertical?.toLowerCase().includes(term) ||
      b.company_name?.toLowerCase().includes(term) ||
      b.pe_firm_name?.toLowerCase().includes(term) ||
      b.thesis_summary?.toLowerCase().includes(term) ||
      b.business_summary?.toLowerCase().includes(term) ||
      b.notes?.toLowerCase().includes(term) ||
      b.alignment_reasoning?.toLowerCase().includes(term)
    );
  }

  // Client-side free-text search — searches ALL buyer data fields
  if (args.search) {
    const term = (args.search as string).toLowerCase();
    results = results.filter(
      (b: any) =>
        b.company_name?.toLowerCase().includes(term) ||
        b.pe_firm_name?.toLowerCase().includes(term) ||
        b.buyer_type?.toLowerCase().includes(term) ||
        b.business_type?.toLowerCase().includes(term) ||
        fieldContains(b.target_services, term) ||
        fieldContains(b.services_offered, term) ||
        fieldContains(b.target_industries, term) ||
        b.industry_vertical?.toLowerCase().includes(term) ||
        b.thesis_summary?.toLowerCase().includes(term) ||
        b.business_summary?.toLowerCase().includes(term) ||
        b.notes?.toLowerCase().includes(term) ||
        b.alignment_reasoning?.toLowerCase().includes(term) ||
        b.revenue_model?.toLowerCase().includes(term) ||
        b.hq_state?.toLowerCase().includes(term) ||
        b.hq_city?.toLowerCase().includes(term) ||
        b.hq_region?.toLowerCase().includes(term) ||
        fieldContains(b.geographic_footprint, term) ||
        fieldContains(b.target_geographies, term) ||
        fieldContains(b.service_regions, term) ||
        fieldContains(b.operating_locations, term),
    );
  }

  return {
    data: {
      buyers: results,
      total: results.length,
      depth,
      state_filter: args.state || null,
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
    supabase
      .from('buyer_contacts')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('is_primary_contact', { ascending: false }),
    supabase
      .from('remarketing_scores')
      .select(
        'listing_id, composite_score, status, tier, geography_score, service_score, size_score, owner_goals_score, fit_reasoning',
      )
      .eq('buyer_id', buyerId)
      .order('composite_score', { ascending: false })
      .limit(10),
    supabase
      .from('call_transcripts')
      .select('id, created_at, call_type, ceo_detected, key_quotes, extracted_insights')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(5),
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
  // Increase default limit to allow counting all buyers in a universe
  // Use 1000 when state filter is requested so geographic counts are accurate
  const defaultLimit = args.state ? 1000 : 20;
  const limit = Math.min(Number(args.limit) || defaultLimit, 2000);

  let query = supabase
    .from('remarketing_scores')
    .select(
      `
      buyer_id, composite_score, status, tier,
      geography_score, service_score, size_score, owner_goals_score,
      acquisition_score, business_model_score, portfolio_score,
      fit_reasoning, pass_reason
    `,
    )
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

  // Fetch buyer details for the scored buyer IDs
  const buyerIds = scores.map((s: any) => s.buyer_id);
  let buyerQuery = supabase
    .from('remarketing_buyers')
    .select(
      'id, company_name, pe_firm_name, buyer_type, hq_state, hq_city, has_fee_agreement, geographic_footprint',
    )
    .in('id', buyerIds);

  // Apply state filter at DB level when requested
  if (args.state) {
    const st = (args.state as string).toUpperCase();
    buyerQuery = buyerQuery.or(`hq_state.eq.${st},geographic_footprint.cs.{${st}}`);
  }

  const { data: buyers } = await buyerQuery;

  const buyerMap = new Map((buyers || []).map((b: any) => [b.id, b]));

  // When state filter is active, only include buyers that matched the state filter
  const enriched = scores
    .map((s: any) => ({
      ...s,
      buyer: buyerMap.get(s.buyer_id) || null,
    }))
    .filter((s: any) => !args.state || s.buyer !== null); // filter out non-matching buyers when state is specified

  return {
    data: {
      buyers: enriched,
      total: enriched.length,
      deal_id: dealId,
      state_filter: args.state || null,
    },
  };
}

async function searchLeadSources(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const sourceType = (args.source_type as string) || 'all';
  const requestedLimit = Number(args.limit) || 5000;

  // Map source type to deal_source values
  const sourceMap: Record<string, string[]> = {
    captarget: ['captarget', 'cp_target'],
    go_partners: ['go_partners', 'go-partners'],
    marketplace: ['marketplace'],
    internal: ['internal', 'direct'],
  };

  // Paginate to fetch all matching rows using correct listing fields
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let offset = 0;

  while (offset < requestedLimit) {
    const batchSize = Math.min(PAGE_SIZE, requestedLimit - offset);
    let query = supabase
      .from('listings')
      .select(LISTING_LEAD_FIELDS)
      .is('deleted_at', null)
      .order('deal_total_score', { ascending: false, nullsFirst: false })
      .range(offset, offset + batchSize - 1);

    if (sourceType !== 'all') {
      const sources = sourceMap[sourceType] || [sourceType];
      query = query.in('deal_source', sources);
    }
    if (args.status) query = query.eq('status', args.status as string);

    const { data: batch, error } = await query;
    if (error) return { error: error.message };
    if (!batch || batch.length === 0) break;
    allData = allData.concat(batch);
    if (batch.length < batchSize) break;
    offset += batch.length;
  }

  // Client-side industry keyword filter — checks industry, category, categories, title, and services
  if (args.industry) {
    const term = (args.industry as string).toLowerCase();
    allData = allData.filter((d: Record<string, unknown>) => {
      const industry = ((d.industry as string) || '').toLowerCase();
      const category = ((d.category as string) || '').toLowerCase();
      const categories = ((d.categories as string[]) || []);
      const title = ((d.title as string) || '').toLowerCase();
      const services = ((d.services as string[]) || []);
      return (
        industry.includes(term) ||
        category.includes(term) ||
        categories.some((c: string) => c.toLowerCase().includes(term)) ||
        title.includes(term) ||
        services.some((s: string) => s.toLowerCase().includes(term))
      );
    });
  }

  // Source breakdown
  const sourceBreakdown: Record<string, number> = {};
  const industryBreakdown: Record<string, number> = {};
  for (const d of allData) {
    const src = ((d as Record<string, unknown>).deal_source as string) || 'unknown';
    sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;

    const ind = ((d as Record<string, unknown>).industry as string) || 'unknown';
    industryBreakdown[ind] = (industryBreakdown[ind] || 0) + 1;
  }

  return {
    data: {
      deals: allData,
      total: allData.length,
      source_breakdown: sourceBreakdown,
      industry_breakdown: industryBreakdown,
    },
  };
}

async function searchValuationLeads(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const calcType = (args.calculator_type as string) || 'all';
  const limit = Math.min(Number(args.limit) || 5000, 10000);

  let query = supabase
    .from('valuation_leads')
    .select(
      'id, calculator_type, display_name, business_name, industry, region, location, revenue, ebitda, lead_score, quality_tier, status, pushed_to_all_deals, excluded, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (calcType !== 'all') {
    query = query.eq('calculator_type', calcType);
  }
  if (args.status) query = query.eq('status', args.status as string);
  if (args.include_excluded !== true) query = query.eq('excluded', false);
  if (args.pushed_to_deals !== undefined)
    query = query.eq('pushed_to_all_deals', args.pushed_to_deals as boolean);
  if (args.min_revenue) query = query.gte('revenue', args.min_revenue as number);

  const { data, error } = await query;
  if (error) return { error: error.message };

  const leads = data || [];

  // Aggregate by calculator type
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const l of leads) {
    byType[l.calculator_type] = (byType[l.calculator_type] || 0) + 1;
    const st = l.status || 'unknown';
    byStatus[st] = (byStatus[st] || 0) + 1;
  }

  return {
    data: {
      leads,
      total: leads.length,
      by_calculator_type: byType,
      by_status: byStatus,
      calculator_type_filter: calcType,
    },
  };
}
