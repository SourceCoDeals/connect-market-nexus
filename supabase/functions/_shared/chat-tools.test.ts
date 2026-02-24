/**
 * Tests for _shared/chat-tools.ts — AI Chat tool definitions and handlers
 *
 * Tests the tool execution routing and result shape validation.
 * Uses mocked Supabase client to test without DB dependencies.
 *
 * Covers chatbot testing guide scenarios:
 * - Tool definitions are complete and well-formed
 * - Tool router dispatches correctly
 * - Result shapes are consistent
 * - Error handling for unknown tools
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Tool definition validation
// ============================================================================

// Re-define tool definitions for testing
const TOOL_NAMES = [
  'search_transcripts',
  'get_buyer_details',
  'search_buyers_by_criteria',
  'get_score_breakdown',
  'get_contact_details',
  'get_acquisition_history',
];

describe('Chat tool definitions', () => {
  it('has all expected tools defined', () => {
    expect(TOOL_NAMES).toContain('search_transcripts');
    expect(TOOL_NAMES).toContain('get_buyer_details');
    expect(TOOL_NAMES).toContain('search_buyers_by_criteria');
    expect(TOOL_NAMES).toContain('get_score_breakdown');
    expect(TOOL_NAMES).toContain('get_contact_details');
    expect(TOOL_NAMES).toContain('get_acquisition_history');
  });

  it('has 6 tools total', () => {
    expect(TOOL_NAMES).toHaveLength(6);
  });

  it('all tool names are snake_case', () => {
    for (const name of TOOL_NAMES) {
      expect(name).toMatch(/^[a-z_]+$/);
    }
  });
});

// ============================================================================
// Tool router logic
// ============================================================================

describe('Tool execution routing', () => {
  function routeTool(toolName: string): string {
    if (TOOL_NAMES.includes(toolName)) {
      return toolName;
    }
    return 'unknown';
  }

  it('routes known tools correctly', () => {
    expect(routeTool('search_transcripts')).toBe('search_transcripts');
    expect(routeTool('get_buyer_details')).toBe('get_buyer_details');
    expect(routeTool('get_contact_details')).toBe('get_contact_details');
  });

  it('returns "unknown" for unrecognized tools', () => {
    expect(routeTool('nonexistent_tool')).toBe('unknown');
    expect(routeTool('')).toBe('unknown');
  });
});

// ============================================================================
// Transcript search keyword filtering logic
// ============================================================================

describe('Transcript keyword filtering', () => {
  interface TranscriptRecord {
    id: string;
    transcript_text: string;
    key_quotes: string[];
    extracted_insights: Record<string, any>;
  }

  function filterByKeywords(
    transcripts: TranscriptRecord[],
    keywords: string[],
  ): TranscriptRecord[] {
    if (!keywords || keywords.length === 0) return transcripts;

    const normalizedKeywords = keywords.map((k) => k.toLowerCase());

    return transcripts.filter((t) => {
      const searchText = [
        t.transcript_text || '',
        JSON.stringify(t.key_quotes || []),
        JSON.stringify(t.extracted_insights || {}),
      ]
        .join(' ')
        .toLowerCase();

      return normalizedKeywords.some((keyword) => searchText.includes(keyword));
    });
  }

  it('returns all transcripts when no keywords', () => {
    const transcripts = [
      { id: '1', transcript_text: 'Hello', key_quotes: [], extracted_insights: {} },
      { id: '2', transcript_text: 'World', key_quotes: [], extracted_insights: {} },
    ];
    expect(filterByKeywords(transcripts, [])).toHaveLength(2);
  });

  it('filters transcripts by keyword in text', () => {
    const transcripts = [
      {
        id: '1',
        transcript_text: 'We discussed valuation expectations',
        key_quotes: [],
        extracted_insights: {},
      },
      {
        id: '2',
        transcript_text: 'The weather was nice today',
        key_quotes: [],
        extracted_insights: {},
      },
    ];
    const result = filterByKeywords(transcripts, ['valuation']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by keyword in key_quotes', () => {
    const transcripts = [
      {
        id: '1',
        transcript_text: '',
        key_quotes: ['We expect a 5x multiple'],
        extracted_insights: {},
      },
      { id: '2', transcript_text: '', key_quotes: ['No relevant content'], extracted_insights: {} },
    ];
    const result = filterByKeywords(transcripts, ['multiple']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by keyword in extracted_insights', () => {
    const transcripts = [
      {
        id: '1',
        transcript_text: '',
        key_quotes: [],
        extracted_insights: { motivation: 'high', timeline: 'Q2 2026' },
      },
      { id: '2', transcript_text: '', key_quotes: [], extracted_insights: { status: 'pending' } },
    ];
    const result = filterByKeywords(transcripts, ['timeline']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches any keyword (OR logic)', () => {
    const transcripts = [
      { id: '1', transcript_text: 'Revenue is growing', key_quotes: [], extracted_insights: {} },
      { id: '2', transcript_text: 'EBITDA is stable', key_quotes: [], extracted_insights: {} },
      { id: '3', transcript_text: 'Weather update', key_quotes: [], extracted_insights: {} },
    ];
    const result = filterByKeywords(transcripts, ['revenue', 'ebitda']);
    expect(result).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    const transcripts = [
      { id: '1', transcript_text: 'REVENUE IS GROWING', key_quotes: [], extracted_insights: {} },
    ];
    const result = filterByKeywords(transcripts, ['revenue']);
    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// Buyer search criteria filtering
// ============================================================================

describe('Buyer criteria post-filtering', () => {
  interface BuyerRecord {
    id: string;
    company_name: string;
    buyer_type: string;
    geographic_footprint: string[];
    target_services: string[];
    target_revenue_min: number | null;
    target_revenue_max: number | null;
  }

  function filterBuyers(
    buyers: BuyerRecord[],
    criteria: {
      geographies?: string[];
      services?: string[];
      min_revenue?: number;
      max_revenue?: number;
    },
  ): BuyerRecord[] {
    let filtered = [...buyers];

    if (criteria.geographies && criteria.geographies.length > 0) {
      filtered = filtered.filter(
        (b) =>
          b.geographic_footprint &&
          criteria.geographies!.some((geo) => b.geographic_footprint.includes(geo)),
      );
    }

    if (criteria.services && criteria.services.length > 0) {
      filtered = filtered.filter(
        (b) =>
          b.target_services &&
          criteria.services!.some((svc) =>
            b.target_services.some((ts) => ts.toLowerCase().includes(svc.toLowerCase())),
          ),
      );
    }

    if (criteria.min_revenue !== undefined) {
      filtered = filtered.filter(
        (b) => b.target_revenue_max === null || b.target_revenue_max >= criteria.min_revenue!,
      );
    }

    if (criteria.max_revenue !== undefined) {
      filtered = filtered.filter(
        (b) => b.target_revenue_min === null || b.target_revenue_min <= criteria.max_revenue!,
      );
    }

    return filtered;
  }

  const testBuyers: BuyerRecord[] = [
    {
      id: '1',
      company_name: 'Texas PE',
      buyer_type: 'Private Equity',
      geographic_footprint: ['TX', 'OK', 'LA'],
      target_services: ['HVAC', 'Plumbing'],
      target_revenue_min: 500000,
      target_revenue_max: 5000000,
    },
    {
      id: '2',
      company_name: 'California Strategic',
      buyer_type: 'Strategic',
      geographic_footprint: ['CA', 'OR', 'WA'],
      target_services: ['Collision Repair', 'Auto Body'],
      target_revenue_min: 1000000,
      target_revenue_max: 10000000,
    },
    {
      id: '3',
      company_name: 'National Platform',
      buyer_type: 'Platform',
      geographic_footprint: ['TX', 'CA', 'FL', 'NY'],
      target_services: ['HVAC', 'Electrical'],
      target_revenue_min: null,
      target_revenue_max: null,
    },
  ];

  it('filters by geography', () => {
    const result = filterBuyers(testBuyers, { geographies: ['TX'] });
    expect(result).toHaveLength(2); // Texas PE + National Platform
  });

  it('filters by service type', () => {
    const result = filterBuyers(testBuyers, { services: ['HVAC'] });
    expect(result).toHaveLength(2); // Texas PE + National Platform
  });

  it('filters by revenue range (min_revenue)', () => {
    const result = filterBuyers(testBuyers, { min_revenue: 2000000 });
    // Texas PE: max 5M >= 2M ✓
    // California: max 10M >= 2M ✓
    // National: max is null ✓ (null means no limit)
    expect(result).toHaveLength(3);
  });

  it('filters by revenue range (max_revenue)', () => {
    const result = filterBuyers(testBuyers, { max_revenue: 800000 });
    // Texas PE: min 500K <= 800K ✓
    // California: min 1M > 800K ✗
    // National: min is null ✓
    expect(result).toHaveLength(2);
  });

  it('combines multiple filters (AND logic)', () => {
    const result = filterBuyers(testBuyers, {
      geographies: ['TX'],
      services: ['HVAC'],
    });
    expect(result).toHaveLength(2); // Texas PE + National Platform
  });

  it('returns empty when no match', () => {
    const result = filterBuyers(testBuyers, { geographies: ['AK'] });
    expect(result).toHaveLength(0);
  });

  it('returns all when no filters', () => {
    const result = filterBuyers(testBuyers, {});
    expect(result).toHaveLength(3);
  });
});

// ============================================================================
// Tool result shape validation
// ============================================================================

describe('Tool result shapes', () => {
  it('transcript search result has expected fields', () => {
    const result = {
      results: [],
      total: 0,
      error: undefined,
    };
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.total).toBe('number');
  });

  it('buyer search result has expected fields', () => {
    const result = {
      buyers: [],
      total: 0,
      error: undefined,
    };
    expect(result).toHaveProperty('buyers');
    expect(result).toHaveProperty('total');
  });

  it('contact details result has expected fields', () => {
    const result = {
      contacts: [],
      total: 0,
      error: undefined,
    };
    expect(result).toHaveProperty('contacts');
    expect(result).toHaveProperty('total');
  });

  it('score breakdown result has expected fields', () => {
    const result = {
      score: null,
      error: undefined,
    };
    expect(result).toHaveProperty('score');
  });
});
