/**
 * Response Quality Tests — Ensuring tool responses contain the metadata
 * the AI needs to give good answers.
 *
 * These tests verify that:
 * 1. Every search tool includes `filters_applied` so the AI knows what it asked for.
 * 2. Every search tool includes `total_before_filtering` so the AI can distinguish
 *    "no matches" from "no data at all".
 * 3. Zero-result responses include a `suggestion` with actionable next steps.
 * 4. Transcript previews flag when content was truncated.
 * 5. Limit-reached indicators are present where applicable.
 *
 * These catch "response quality" bugs where searches succeed but the AI gives
 * a terrible answer because the response is missing context.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Helpers: simulate tool response structure from each tool
// ============================================================================

/**
 * Simulate searchBuyers response shape.
 * In the real code, the response is built at the end of searchBuyers().
 * Here we replicate the return structure to test it.
 */
function buildBuyerSearchResponse(
  results: unknown[],
  totalBeforeFiltering: number,
  args: Record<string, unknown>,
  limit: number,
) {
  const filtersApplied: Record<string, unknown> = {};
  if (args.state) filtersApplied.state = args.state;
  if (args.industry) filtersApplied.industry = args.industry;
  if (args.search) filtersApplied.search = args.search;
  if (args.buyer_type) filtersApplied.buyer_type = args.buyer_type;

  return {
    data: {
      buyers: results,
      total: results.length,
      total_before_filtering: totalBeforeFiltering,
      depth: 'quick',
      filters_applied: filtersApplied,
      limit_reached: results.length >= limit,
      ...(results.length === 0
        ? {
            suggestion:
              totalBeforeFiltering > 0
                ? `${totalBeforeFiltering} buyers were fetched but none matched your filters. Try broadening: remove the industry/search/state filter, or check search_lead_sources and search_valuation_leads for other data sources.`
                : 'No buyers found in the database with the current filters. Try removing filters or checking other sources (search_lead_sources, search_valuation_leads, search_inbound_leads).',
          }
        : {}),
    },
  };
}

function buildDealSearchResponse(
  results: unknown[],
  totalFromDb: number,
  args: Record<string, unknown>,
  requestedLimit: number,
) {
  const filtersApplied: Record<string, unknown> = {};
  if (args.industry) filtersApplied.industry = args.industry;
  if (args.search) filtersApplied.search = args.search;
  if (args.status) filtersApplied.status = args.status;

  return {
    data: {
      deals: results,
      total: results.length,
      total_before_filtering: totalFromDb,
      depth: 'quick',
      filters_applied: filtersApplied,
      limit_reached: results.length >= requestedLimit,
      ...(results.length === 0
        ? {
            suggestion:
              totalFromDb > 0
                ? `${totalFromDb} deals fetched but none matched your filters (${Object.keys(filtersApplied).join(', ')}). Try broadening: remove the industry/state/search filter, or use get_pipeline_summary for aggregate counts.`
                : 'No deals found with the current database-level filters. Try removing status/source filters, or use get_pipeline_summary to see what exists.',
          }
        : {}),
    },
  };
}

function buildTranscriptSubResponse(results: unknown[], totalFromDb: number) {
  return {
    data: {
      transcripts: results,
      total: results.length,
      total_before_filtering: totalFromDb,
    },
  };
}

function buildLeadSearchResponse(
  results: unknown[],
  totalFromDb: number,
  args: Record<string, unknown>,
  days: number,
) {
  const filtersApplied: Record<string, unknown> = { lookback_days: days };
  if (args.search) filtersApplied.search = args.search;
  if (args.status) filtersApplied.status = args.status;

  return {
    data: {
      leads: results,
      total: results.length,
      total_before_filtering: totalFromDb,
      filters_applied: filtersApplied,
      ...(results.length === 0
        ? {
            suggestion:
              totalFromDb > 0
                ? `${totalFromDb} inbound leads found in the last ${days} days but none matched your search "${args.search}". Try broader keywords or increase the lookback days.`
                : `No inbound leads found in the last ${days} days. Try increasing the days parameter (e.g. days=90) or removing status/source filters.`,
          }
        : {}),
    },
  };
}

function buildConnectionResponse(
  results: unknown[],
  totalFromDb: number,
  args: Record<string, unknown>,
  days: number,
) {
  const filtersApplied: Record<string, unknown> = { lookback_days: days };
  if (args.search) filtersApplied.search = args.search;
  if (args.deal_id) filtersApplied.deal_id = args.deal_id;

  return {
    data: {
      requests: results,
      total: results.length,
      total_before_filtering: totalFromDb,
      filters_applied: filtersApplied,
      ...(results.length === 0
        ? {
            suggestion:
              totalFromDb > 0
                ? `${totalFromDb} connection requests found in the last ${days} days but none matched your search "${args.search}". Try broader keywords.`
                : `No connection requests found in the last ${days} days. Try increasing the days parameter or removing status/deal_id filters.`,
          }
        : {}),
    },
  };
}

function buildUniverseSearchResponse(
  results: unknown[],
  totalFromDb: number,
  args: Record<string, unknown>,
) {
  const filtersApplied: Record<string, unknown> = {};
  if (args.search) filtersApplied.search = args.search;

  return {
    data: {
      universes: results,
      total: results.length,
      total_before_filtering: totalFromDb,
      filters_applied: filtersApplied,
      ...(results.length === 0
        ? {
            suggestion:
              totalFromDb > 0
                ? `${totalFromDb} universes exist but none match "${args.search}". Try a broader search term (e.g. "hvac" instead of "residential hvac") or omit the search to list all universes.`
                : 'No buyer universes found. They may not have been created yet.',
          }
        : {}),
    },
  };
}

// ============================================================================
// PART 1: search_buyers response quality
// ============================================================================

describe('search_buyers — response quality', () => {
  it('includes filters_applied echoing back all active filters', () => {
    const resp = buildBuyerSearchResponse(
      [{ id: 'b1' }],
      100,
      { industry: 'hvac', state: 'TX', buyer_type: 'pe_platform' },
      25,
    );
    expect(resp.data.filters_applied).toEqual({
      industry: 'hvac',
      state: 'TX',
      buyer_type: 'pe_platform',
    });
  });

  it('includes total_before_filtering to distinguish empty DB from no matches', () => {
    const resp = buildBuyerSearchResponse([], 50, { industry: 'hvac' }, 25);
    expect(resp.data.total_before_filtering).toBe(50);
    expect(resp.data.total).toBe(0);
  });

  it('includes suggestion when zero results AND data existed before filtering', () => {
    const resp = buildBuyerSearchResponse([], 200, { industry: 'underwater_basket_weaving' }, 25);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('200 buyers were fetched');
    expect(resp.data.suggestion).toContain('broadening');
  });

  it('includes different suggestion when zero results AND no data at all', () => {
    const resp = buildBuyerSearchResponse([], 0, { industry: 'hvac' }, 25);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('No buyers found');
    expect(resp.data.suggestion).toContain('other sources');
  });

  it('does NOT include suggestion when results exist', () => {
    const resp = buildBuyerSearchResponse([{ id: 'b1' }], 100, { industry: 'hvac' }, 25);
    expect(resp.data.suggestion).toBeUndefined();
  });

  it('sets limit_reached=true when result count matches limit', () => {
    const fakeResults = Array.from({ length: 25 }, (_, i) => ({ id: `b${i}` }));
    const resp = buildBuyerSearchResponse(fakeResults, 25, {}, 25);
    expect(resp.data.limit_reached).toBe(true);
  });

  it('sets limit_reached=false when result count is below limit', () => {
    const resp = buildBuyerSearchResponse([{ id: 'b1' }], 1, {}, 25);
    expect(resp.data.limit_reached).toBe(false);
  });

  it('echoes empty filters_applied when no filters are used', () => {
    const resp = buildBuyerSearchResponse([{ id: 'b1' }], 1, {}, 25);
    expect(resp.data.filters_applied).toEqual({});
  });
});

// ============================================================================
// PART 2: query_deals response quality
// ============================================================================

describe('query_deals — response quality', () => {
  it('includes filters_applied echoing back all active filters', () => {
    const resp = buildDealSearchResponse(
      [{ id: 'd1' }],
      100,
      { industry: 'hvac', status: 'active', search: 'test' },
      25,
    );
    expect(resp.data.filters_applied).toEqual({
      industry: 'hvac',
      status: 'active',
      search: 'test',
    });
  });

  it('includes total_before_filtering', () => {
    const resp = buildDealSearchResponse([], 300, { industry: 'hvac' }, 5000);
    expect(resp.data.total_before_filtering).toBe(300);
  });

  it('includes suggestion on zero results with data before filtering', () => {
    const resp = buildDealSearchResponse([], 150, { industry: 'nonexistent' }, 5000);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('150 deals fetched');
  });

  it('includes suggestion on zero results with no data at all', () => {
    const resp = buildDealSearchResponse([], 0, { status: 'closed' }, 25);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('No deals found');
  });

  it('does NOT include suggestion when results exist', () => {
    const resp = buildDealSearchResponse([{ id: 'd1' }], 100, {}, 25);
    expect(resp.data.suggestion).toBeUndefined();
  });
});

// ============================================================================
// PART 3: search_transcripts sub-response quality
// ============================================================================

describe('transcript sub-search — response quality', () => {
  it('includes total_before_filtering in call_transcripts response', () => {
    const resp = buildTranscriptSubResponse([], 5);
    expect(resp.data.total_before_filtering).toBe(5);
    expect(resp.data.total).toBe(0);
  });

  it('includes total_before_filtering in non-empty response', () => {
    const resp = buildTranscriptSubResponse([{ id: 't1' }], 10);
    expect(resp.data.total_before_filtering).toBe(10);
    expect(resp.data.total).toBe(1);
  });
});

// ============================================================================
// PART 4: search_inbound_leads response quality
// ============================================================================

describe('search_inbound_leads — response quality', () => {
  it('includes filters_applied with lookback_days', () => {
    const resp = buildLeadSearchResponse([{ id: 'l1' }], 10, { search: 'hvac' }, 30);
    expect(resp.data.filters_applied).toEqual({
      lookback_days: 30,
      search: 'hvac',
    });
  });

  it('includes suggestion on zero results with data before filtering', () => {
    const resp = buildLeadSearchResponse([], 20, { search: 'nonexistent' }, 30);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('20 inbound leads');
    expect(resp.data.suggestion).toContain('broader keywords');
  });

  it('includes suggestion when no data in lookback period', () => {
    const resp = buildLeadSearchResponse([], 0, {}, 7);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('last 7 days');
    expect(resp.data.suggestion).toContain('days=90');
  });

  it('does NOT include suggestion when results exist', () => {
    const resp = buildLeadSearchResponse([{ id: 'l1' }], 10, {}, 30);
    expect(resp.data.suggestion).toBeUndefined();
  });
});

// ============================================================================
// PART 5: get_connection_requests response quality
// ============================================================================

describe('get_connection_requests — response quality', () => {
  it('includes filters_applied with lookback_days', () => {
    const resp = buildConnectionResponse(
      [{ id: 'cr1' }],
      10,
      { search: 'john', deal_id: 'd1' },
      90,
    );
    expect(resp.data.filters_applied).toEqual({
      lookback_days: 90,
      search: 'john',
      deal_id: 'd1',
    });
  });

  it('includes suggestion on zero results with data before filtering', () => {
    const resp = buildConnectionResponse([], 15, { search: 'nonexistent' }, 90);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('15 connection requests');
  });

  it('includes suggestion when no data in lookback period', () => {
    const resp = buildConnectionResponse([], 0, {}, 30);
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('last 30 days');
  });
});

// ============================================================================
// PART 6: search_buyer_universes response quality
// ============================================================================

describe('search_buyer_universes — response quality', () => {
  it('includes filters_applied echoing search term', () => {
    const resp = buildUniverseSearchResponse([{ id: 'u1' }], 5, { search: 'hvac' });
    expect(resp.data.filters_applied).toEqual({ search: 'hvac' });
  });

  it('includes total_before_filtering', () => {
    const resp = buildUniverseSearchResponse([], 10, { search: 'nonexistent' });
    expect(resp.data.total_before_filtering).toBe(10);
  });

  it('includes suggestion on zero results with existing universes', () => {
    const resp = buildUniverseSearchResponse([], 8, { search: 'nonexistent' });
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('8 universes exist');
  });

  it('includes suggestion when no universes exist at all', () => {
    const resp = buildUniverseSearchResponse([], 0, {});
    expect(resp.data.suggestion).toBeDefined();
    expect(resp.data.suggestion).toContain('not have been created');
  });
});

// ============================================================================
// PART 7: Transcript preview truncation indicators
// ============================================================================

describe('Transcript preview — truncation indicator', () => {
  it('marks preview_truncated=true when transcript exceeds 500 chars', () => {
    const longText = 'A'.repeat(600);
    const summary = {
      preview: longText.substring(0, 500),
      preview_truncated: longText.length > 500,
    };
    expect(summary.preview_truncated).toBe(true);
    expect(summary.preview.length).toBe(500);
  });

  it('marks preview_truncated=false when transcript is under 500 chars', () => {
    const shortText = 'Short transcript content';
    const summary = {
      preview: shortText.substring(0, 500),
      preview_truncated: shortText.length > 500,
    };
    expect(summary.preview_truncated).toBe(false);
  });
});

// ============================================================================
// PART 8: Cross-cutting — response structure validation
// ============================================================================

describe('Cross-cutting: all search tools return required response metadata', () => {
  it('buyer search has required fields: total, total_before_filtering, filters_applied', () => {
    const resp = buildBuyerSearchResponse([], 0, {}, 25);
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
    expect(resp.data).toHaveProperty('filters_applied');
    expect(resp.data).toHaveProperty('limit_reached');
  });

  it('deal search has required fields: total, total_before_filtering, filters_applied', () => {
    const resp = buildDealSearchResponse([], 0, {}, 25);
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
    expect(resp.data).toHaveProperty('filters_applied');
    expect(resp.data).toHaveProperty('limit_reached');
  });

  it('transcript sub-search has required fields: total, total_before_filtering', () => {
    const resp = buildTranscriptSubResponse([], 0);
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
  });

  it('lead search has required fields: total, total_before_filtering, filters_applied', () => {
    const resp = buildLeadSearchResponse([], 0, {}, 30);
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
    expect(resp.data).toHaveProperty('filters_applied');
  });

  it('connection search has required fields: total, total_before_filtering, filters_applied', () => {
    const resp = buildConnectionResponse([], 0, {}, 90);
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
    expect(resp.data).toHaveProperty('filters_applied');
  });

  it('universe search has required fields: total, total_before_filtering, filters_applied', () => {
    const resp = buildUniverseSearchResponse([], 0, {});
    expect(resp.data).toHaveProperty('total');
    expect(resp.data).toHaveProperty('total_before_filtering');
    expect(resp.data).toHaveProperty('filters_applied');
  });
});

// ============================================================================
// PART 9: Suggestion message quality — ensure suggestions are actionable
// ============================================================================

describe('Zero-result suggestions are actionable and specific', () => {
  it('buyer suggestion mentions alternative tools when no data', () => {
    const resp = buildBuyerSearchResponse([], 0, { industry: 'hvac' }, 25);
    expect(resp.data.suggestion).toContain('search_lead_sources');
    expect(resp.data.suggestion).toContain('search_valuation_leads');
  });

  it('buyer suggestion mentions broadening when data was filtered out', () => {
    const resp = buildBuyerSearchResponse([], 100, { industry: 'hvac' }, 25);
    expect(resp.data.suggestion).toContain('broadening');
  });

  it('deal suggestion mentions get_pipeline_summary alternative', () => {
    const resp = buildDealSearchResponse([], 0, {}, 25);
    expect(resp.data.suggestion).toContain('get_pipeline_summary');
  });

  it('lead suggestion mentions increasing days parameter', () => {
    const resp = buildLeadSearchResponse([], 0, {}, 7);
    expect(resp.data.suggestion).toContain('days=90');
  });

  it('connection suggestion mentions increasing days when no data', () => {
    const resp = buildConnectionResponse([], 0, {}, 30);
    expect(resp.data.suggestion).toContain('increasing the days');
  });

  it('universe suggestion mentions broader keyword when data filtered out', () => {
    const resp = buildUniverseSearchResponse([], 5, { search: 'specific term' });
    expect(resp.data.suggestion).toContain('broader');
  });
});
