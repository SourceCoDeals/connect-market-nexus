import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              eq: (...eqArgs2: unknown[]) => {
                mockEq(...eqArgs2);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    })),
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useRejectBuyer', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('writes is_disqualified, rejected_at, rejection_reason, and rejection_notes', async () => {
    const { useRejectBuyer } = await import('./use-reject-buyer');
    const { result } = renderHook(() => useRejectBuyer('listing-1'), { wrapper });

    await act(async () => {
      result.current.mutate({
        listing_id: 'listing-1',
        buyer_id: 'buyer-1',
        rejection_reason: 'Not a fit',
        rejection_notes: 'Too small',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_disqualified: true,
        rejection_reason: 'Not a fit',
        rejection_notes: 'Too small',
      }),
    );

    // Verify rejected_at was included
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.rejected_at).toBeDefined();
    expect(updateArg.is_disqualified).toBe(true);

    // Verify eq filters for listing_id and buyer_id
    expect(mockEq).toHaveBeenCalledWith('listing_id', 'listing-1');
    expect(mockEq).toHaveBeenCalledWith('buyer_id', 'buyer-1');
  });

  it('shows success toast on mutation success', async () => {
    const { toast } = await import('sonner');
    const { useRejectBuyer } = await import('./use-reject-buyer');
    const { result } = renderHook(() => useRejectBuyer('listing-1'), { wrapper });

    await act(async () => {
      result.current.mutate({
        listing_id: 'listing-1',
        buyer_id: 'buyer-2',
        rejection_reason: 'Conflict of interest',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Buyer rejected');
  });
});
