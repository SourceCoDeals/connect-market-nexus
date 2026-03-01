import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRecommendedBuyers } from './use-recommended-buyers';

// ============================================================================
// Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

/** Build a mock score row */
function makeScore(overrides: Record<string, unknown> = {}) {
  return {
    buyer_id: 'buyer-1',
    composite_score: 50,
    geography_score: 50,
    service_score: 50,
    size_score: 50,
    owner_goals_score: 50,
    tier: null,
    status: 'scored',
    fit_reasoning: null,
    human_override_score: null,
    is_disqualified: false,
    ...overrides,
  };
}

/** Build a mock buyer row */
function makeBuyer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'buyer-1',
    company_name: 'Acme Corp',
    pe_firm_name: null,
    buyer_type: 'strategic',
    hq_state: 'TX',
    hq_city: 'Houston',
    acquisition_appetite: 'active',
    has_fee_agreement: false,
    thesis_summary: null,
    total_acquisitions: 3,
    archived: false,
    ...overrides,
  };
}

/**
 * Sets up supabase.from mock to return specific data for different tables.
 * Each table config maps to a chainable mock that resolves to { data, error }.
 */
function setupSupabaseMock(tableData: Record<string, { data: unknown; error: unknown }>) {
  const fromMock = vi.mocked(supabase.from);
  fromMock.mockImplementation((table: string) => {
    const result = tableData[table] || { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const _chainFn = () => chain;
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.or = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.not = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue(result);
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    // Make the chain itself thenable so `await supabase.from(...).select(...)...` resolves
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(result));
    return chain as ReturnType<typeof supabase.from>;
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('useRecommendedBuyers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Empty / no listing
  // --------------------------------------------------------------------------
  it('returns empty result when listingId is undefined', async () => {
    const { result } = renderHook(() => useRecommendedBuyers(undefined), {
      wrapper: createWrapper(),
    });
    // enabled is false so it should not fetch
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('returns empty buyers when no scores are found', async () => {
    setupSupabaseMock({
      remarketing_scores: { data: [], error: null },
    });

    const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.buyers).toHaveLength(0);
    expect(result.current.data!.total).toBe(0);
  });

  // --------------------------------------------------------------------------
  // classifyTier — tested indirectly through hook output
  // --------------------------------------------------------------------------
  describe('classifyTier (via hook output)', () => {
    it('score >= 80 with fee agreement -> "Move Now"', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 85 })];
      const buyers = [makeBuyer({ id: 'b1', has_fee_agreement: true })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const buyer = result.current.data!.buyers[0];
      expect(buyer.tier).toBe('move_now');
      expect(buyer.tier_label).toBe('Move Now');
    });

    it('score >= 80 with active appetite -> "Move Now"', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 82 })];
      const buyers = [
        makeBuyer({ id: 'b1', has_fee_agreement: false, acquisition_appetite: 'aggressive' }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].tier).toBe('move_now');
      expect(result.current.data!.buyers[0].tier_label).toBe('Move Now');
    });

    it('score 60-79 -> "Strong Candidate"', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].tier).toBe('strong_candidate');
      expect(result.current.data!.buyers[0].tier_label).toBe('Strong Candidate');
    });

    it('score < 60 -> "Speculative"', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 45 })];
      const buyers = [
        makeBuyer({ id: 'b1', has_fee_agreement: false, acquisition_appetite: 'selective' }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].tier).toBe('speculative');
      expect(result.current.data!.buyers[0].tier_label).toBe('Speculative');
    });

    it('score >= 80 without fee agreement or active appetite -> "Strong Candidate"', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 85 })];
      const buyers = [
        makeBuyer({ id: 'b1', has_fee_agreement: false, acquisition_appetite: 'selective' }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      // score is 85 but no fee agreement AND appetite is 'selective' (not active/aggressive)
      // classifyTier: score >= 80 && (hasFeeAgreement || isActive) fails
      // Falls through to score >= 60 → strong_candidate
      expect(result.current.data!.buyers[0].tier).toBe('strong_candidate');
    });
  });

  // --------------------------------------------------------------------------
  // computeFitSignals — tested indirectly through hook output
  // --------------------------------------------------------------------------
  describe('computeFitSignals (via hook output)', () => {
    it('generates geography signal for high geography_score', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70, geography_score: 90 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain(
        'Strong geographic footprint overlap',
      );
    });

    it('generates regional proximity signal for geography_score 60-79', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70, geography_score: 65 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('Regional geographic proximity');
    });

    it('omits geography signal for low geography_score', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70, geography_score: 45 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const signals = result.current.data!.buyers[0].fit_signals;
      expect(signals).not.toContain('Strong geographic footprint overlap');
      expect(signals).not.toContain('Regional geographic proximity');
    });

    it('omits size signal for low size_score', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70, size_score: 45 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const signals = result.current.data!.buyers[0].fit_signals;
      expect(signals).not.toContain('EBITDA and revenue within target range');
      expect(signals).not.toContain('Size within broader acquisition criteria');
    });

    it('generates service alignment signal for high service_score', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70, service_score: 85 })];
      const buyers = [makeBuyer({ id: 'b1' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('Core service/sector alignment');
    });

    it('generates fee agreement signal when has_fee_agreement is true', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 85 })];
      const buyers = [makeBuyer({ id: 'b1', has_fee_agreement: true })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('Fee agreement signed');
    });

    it('generates acquisition mandate signal for active appetite', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70 })];
      const buyers = [makeBuyer({ id: 'b1', acquisition_appetite: 'active' })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('Active acquisition mandate');
    });

    it('generates CEO signal when ceo_detected is true', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70 })];
      const buyers = [makeBuyer({ id: 'b1' })];
      const transcripts = [{ buyer_id: 'b1', call_date: '2025-01-01', ceo_detected: true }];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: transcripts, error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain(
        'CEO/owner participated in call',
      );
    });

    it('generates NDA signal when nda_signed is true', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70 })];
      const buyers = [makeBuyer({ id: 'b1' })];
      const outreach = [
        {
          buyer_id: 'b1',
          contacted_at: '2025-01-01',
          nda_sent_at: '2025-01-02',
          nda_signed_at: '2025-01-03',
          cim_sent_at: null,
          meeting_scheduled_at: null,
          outcome: null,
          updated_at: '2025-01-03',
        },
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: outreach, error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('NDA executed');
    });

    it('generates prior acquisitions signal when total_acquisitions >= 5', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 70 })];
      const buyers = [makeBuyer({ id: 'b1', total_acquisitions: 8 })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals).toContain('8 prior acquisitions');
    });

    it('limits fit_signals to 5 items max', async () => {
      const scores = [
        makeScore({
          buyer_id: 'b1',
          composite_score: 90,
          geography_score: 90,
          size_score: 90,
          service_score: 90,
        }),
      ];
      const buyers = [
        makeBuyer({
          id: 'b1',
          has_fee_agreement: true,
          acquisition_appetite: 'aggressive',
          total_acquisitions: 10,
        }),
      ];
      const transcripts = [
        { buyer_id: 'b1', call_date: '2025-01-01', ceo_detected: true },
        { buyer_id: 'b1', call_date: '2025-02-01', ceo_detected: false },
      ];
      const outreach = [
        {
          buyer_id: 'b1',
          contacted_at: '2025-01-01',
          nda_sent_at: '2025-01-02',
          nda_signed_at: '2025-01-03',
          cim_sent_at: null,
          meeting_scheduled_at: null,
          outcome: null,
          updated_at: '2025-01-03',
        },
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: transcripts, error: null },
        outreach_records: { data: outreach, error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.buyers[0].fit_signals.length).toBeLessThanOrEqual(5);
    });
  });

  // --------------------------------------------------------------------------
  // Sort order
  // --------------------------------------------------------------------------
  describe('sort order', () => {
    it('output is sorted by composite_fit_score descending', async () => {
      const scores = [
        makeScore({ buyer_id: 'b1', composite_score: 60 }),
        makeScore({ buyer_id: 'b2', composite_score: 90 }),
        makeScore({ buyer_id: 'b3', composite_score: 75 }),
      ];
      const buyers = [
        makeBuyer({ id: 'b1', company_name: 'Low Co' }),
        makeBuyer({ id: 'b2', company_name: 'High Co' }),
        makeBuyer({ id: 'b3', company_name: 'Mid Co' }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const resultBuyers = result.current.data!.buyers;
      expect(resultBuyers).toHaveLength(3);
      expect(resultBuyers[0].composite_fit_score).toBe(90);
      expect(resultBuyers[1].composite_fit_score).toBe(75);
      expect(resultBuyers[2].composite_fit_score).toBe(60);
    });

    it('uses fee agreement as tiebreaker when scores are equal', async () => {
      const scores = [
        makeScore({ buyer_id: 'b1', composite_score: 75 }),
        makeScore({ buyer_id: 'b2', composite_score: 75 }),
      ];
      const buyers = [
        makeBuyer({ id: 'b1', company_name: 'No Fee Co', has_fee_agreement: false }),
        makeBuyer({ id: 'b2', company_name: 'Fee Co', has_fee_agreement: true }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const resultBuyers = result.current.data!.buyers;
      expect(resultBuyers[0].company_name).toBe('Fee Co');
      expect(resultBuyers[1].company_name).toBe('No Fee Co');
    });
  });

  // --------------------------------------------------------------------------
  // Tier summary
  // --------------------------------------------------------------------------
  describe('tier summary', () => {
    it('correctly computes tier summary counts', async () => {
      const scores = [
        makeScore({ buyer_id: 'b1', composite_score: 90 }),
        makeScore({ buyer_id: 'b2', composite_score: 65 }),
        makeScore({ buyer_id: 'b3', composite_score: 40 }),
      ];
      const buyers = [
        makeBuyer({ id: 'b1', has_fee_agreement: true }),
        makeBuyer({ id: 'b2' }),
        makeBuyer({ id: 'b3', acquisition_appetite: 'selective' }),
      ];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.tierSummary.move_now).toBe(1);
      expect(result.current.data!.tierSummary.strong_candidate).toBe(1);
      expect(result.current.data!.tierSummary.speculative).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // human_override_score
  // --------------------------------------------------------------------------
  describe('human override score', () => {
    it('uses human_override_score when present instead of composite_score', async () => {
      const scores = [makeScore({ buyer_id: 'b1', composite_score: 50, human_override_score: 95 })];
      const buyers = [makeBuyer({ id: 'b1', has_fee_agreement: true })];

      setupSupabaseMock({
        remarketing_scores: { data: scores, error: null },
        remarketing_buyers: { data: buyers, error: null },
        connection_requests: { data: [], error: null },
        call_transcripts: { data: [], error: null },
        outreach_records: { data: [], error: null },
      });

      const { result } = renderHook(() => useRecommendedBuyers('listing-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const buyer = result.current.data!.buyers[0];
      expect(buyer.composite_fit_score).toBe(95);
      expect(buyer.human_override_score).toBe(95);
      expect(buyer.tier).toBe('move_now');
    });
  });
});
