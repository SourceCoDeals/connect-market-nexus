/**
 * usePipelineMetrics.test.ts
 *
 * Regression tests for the hook that feeds the Pipeline & Velocity tab.
 * Pins the two behaviours that were broken before this branch:
 *   1. loading flips to false when a query errors (previously it stayed true
 *      forever because `loading: dealsLoading || !stages` — if the stages
 *      query failed, `!stages` stayed truthy and the tab was stuck on a
 *      skeleton with no escape hatch).
 *   2. The hook exposes `error` + `retry` so callers can render a banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Supabase client must be mocked before the hook imports it.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
import { usePipelineMetrics } from './usePipelineMetrics';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('usePipelineMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes error and sets loading=false when the stages query fails', async () => {
    // Builder: deal_stages → fails; deal_pipeline → empty.
    const stagesBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('permission denied for table deal_stages'),
      }),
    };
    const dealsBuilder = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === 'deal_stages' ? stagesBuilder : dealsBuilder,
    );

    const { result } = renderHook(() => usePipelineMetrics('30d'), { wrapper });

    // loading must eventually flip to false — otherwise the tab is stuck
    // on a skeleton forever. This is the exact regression the fix targets.
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/permission denied/);
    expect(typeof result.current.retry).toBe('function');
  });

  it('exposes error when the deals query fails', async () => {
    const stagesBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const dealsBuilder = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('network'),
      }),
    };
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === 'deal_stages' ? stagesBuilder : dealsBuilder,
    );

    const { result } = renderHook(() => usePipelineMetrics('30d'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error?.message).toBe('network');
  });

  it('returns error=null on the happy path', async () => {
    const stagesBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi
        .fn()
        .mockResolvedValue({
          data: [{ id: 's1', name: 'Prospect', position: 1, color: null }],
          error: null,
        }),
    };
    const dealsBuilder = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) =>
      table === 'deal_stages' ? stagesBuilder : dealsBuilder,
    );

    const { result } = renderHook(() => usePipelineMetrics('30d'), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.stageRows.length).toBe(1);
  });
});
