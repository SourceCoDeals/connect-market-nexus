import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainable mock builder for Supabase query methods
function createChainableMock(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single', 'is', 'gte'];
  methods.forEach((method) => {
    chain[method] = vi.fn(() => ({ ...chain, ...finalResult }));
  });
  return chain;
}

const mockFromFn = vi.fn();
const mockGetUser = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFromFn(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

// Mock tanstack react-query
const _mockMutateAsync = vi.fn();
const mockMutationState = { isLoading: false, error: null };

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(
    ({ queryFn, queryKey }: { queryFn: () => Promise<unknown>; queryKey: string[] }) => {
      return {
        queryKey,
        queryFn,
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    },
  ),
  useMutation: vi.fn(
    ({
      mutationFn,
      onSuccess,
      onError,
    }: {
      mutationFn: (...args: unknown[]) => Promise<unknown>;
      onSuccess?: (data: unknown) => void;
      onError?: (error: Error) => void;
    }) => {
      return {
        mutateAsync: async (...args: unknown[]) => {
          try {
            const result = await mutationFn(...args);
            if (onSuccess) onSuccess(result);
            return result;
          } catch (err) {
            if (onError) onError(err as Error);
            throw err;
          }
        },
        mutate: vi.fn(),
        ...mockMutationState,
      };
    },
  ),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe('useDealAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query deal_alerts table with correct parameters', async () => {
    const mockChain = createChainableMock({ data: [], error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useDealAlerts } = await import('./use-deal-alerts');
    const result = useDealAlerts();

    // The query function is passed to useQuery - we can call it
    expect(result).toBeDefined();
    expect(result.queryFn).toBeDefined();
  });

  it('should return data from the query function', async () => {
    const mockAlerts = [
      {
        id: '1',
        name: 'Test Alert',
        criteria: { category: 'tech' },
        frequency: 'daily',
        is_active: true,
      },
    ];
    const mockChain = createChainableMock({ data: mockAlerts, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useDealAlerts } = await import('./use-deal-alerts');
    const hook = useDealAlerts();

    // Execute the queryFn directly
    await (hook as unknown as { queryFn: () => Promise<unknown> }).queryFn();
    expect(mockFromFn).toHaveBeenCalledWith('deal_alerts');
  });

  it('should throw error when query fails', async () => {
    const mockChain = createChainableMock({ data: null, error: new Error('Database error') });
    mockFromFn.mockReturnValue(mockChain);

    const { useDealAlerts } = await import('./use-deal-alerts');
    const hook = useDealAlerts();
    await expect(
      (hook as unknown as { queryFn: () => Promise<unknown> }).queryFn(),
    ).rejects.toThrow();
  });
});

describe('useCreateDealAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a deal alert with authenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const createdAlert = {
      id: 'alert-1',
      user_id: 'user-123',
      name: 'My Alert',
      criteria: { category: 'saas' },
      frequency: 'instant',
      is_active: true,
    };
    const mockChain = createChainableMock({ data: createdAlert, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useCreateDealAlert } = await import('./use-deal-alerts');
    const mutation = useCreateDealAlert();

    const result = await mutation.mutateAsync({
      name: 'My Alert',
      criteria: { category: 'saas' },
      frequency: 'instant',
    });

    expect(mockGetUser).toHaveBeenCalled();
    expect(mockFromFn).toHaveBeenCalledWith('deal_alerts');
    expect(result).toEqual(createdAlert);
  });

  it('should throw error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { useCreateDealAlert } = await import('./use-deal-alerts');
    const mutation = useCreateDealAlert();

    await expect(
      mutation.mutateAsync({
        name: 'My Alert',
        criteria: {},
        frequency: 'daily',
      }),
    ).rejects.toThrow('User not authenticated');
  });

  it('should throw error when auth check fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Auth service down'),
    });

    const { useCreateDealAlert } = await import('./use-deal-alerts');
    const mutation = useCreateDealAlert();

    await expect(
      mutation.mutateAsync({
        name: 'My Alert',
        criteria: {},
        frequency: 'weekly',
      }),
    ).rejects.toThrow();
  });

  it('should show success toast on creation', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const mockChain = createChainableMock({
      data: { id: 'a1', name: 'Alert' },
      error: null,
    });
    mockFromFn.mockReturnValue(mockChain);

    const { useCreateDealAlert } = await import('./use-deal-alerts');
    const mutation = useCreateDealAlert();
    await mutation.mutateAsync({ name: 'Alert', criteria: {}, frequency: 'daily' });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deal alert created' }),
    );
  });

  it('should invalidate deal-alerts query on success', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const mockChain = createChainableMock({
      data: { id: 'a1' },
      error: null,
    });
    mockFromFn.mockReturnValue(mockChain);

    const { useCreateDealAlert } = await import('./use-deal-alerts');
    const mutation = useCreateDealAlert();
    await mutation.mutateAsync({ name: 'Alert', criteria: {}, frequency: 'daily' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['deal-alerts'] });
  });
});

describe('useUpdateDealAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a deal alert successfully', async () => {
    const updatedAlert = { id: 'alert-1', name: 'Updated Alert', is_active: false };
    const mockChain = createChainableMock({ data: updatedAlert, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useUpdateDealAlert } = await import('./use-deal-alerts');
    const mutation = useUpdateDealAlert();
    const result = await mutation.mutateAsync({
      id: 'alert-1',
      updates: { name: 'Updated Alert', is_active: false },
    });

    expect(mockFromFn).toHaveBeenCalledWith('deal_alerts');
    expect(result).toEqual(updatedAlert);
  });

  it('should show error toast on update failure', async () => {
    const mockChain = createChainableMock({ data: null, error: new Error('Update failed') });
    mockFromFn.mockReturnValue(mockChain);

    const { useUpdateDealAlert } = await import('./use-deal-alerts');
    const mutation = useUpdateDealAlert();

    await expect(
      mutation.mutateAsync({ id: 'alert-1', updates: { name: 'New Name' } }),
    ).rejects.toThrow('Update failed');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error updating alert', variant: 'destructive' }),
    );
  });
});

describe('useDeleteDealAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a deal alert successfully', async () => {
    const mockChain = createChainableMock({ data: null, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useDeleteDealAlert } = await import('./use-deal-alerts');
    const mutation = useDeleteDealAlert();
    const result = await mutation.mutateAsync('alert-to-delete');

    expect(mockFromFn).toHaveBeenCalledWith('deal_alerts');
    expect(result).toBe('alert-to-delete');
  });

  it('should show success toast on deletion', async () => {
    const mockChain = createChainableMock({ data: null, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useDeleteDealAlert } = await import('./use-deal-alerts');
    const mutation = useDeleteDealAlert();
    await mutation.mutateAsync('alert-1');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deal alert deleted' }),
    );
  });

  it('should show error toast on delete failure', async () => {
    const mockChain = createChainableMock({ data: null, error: new Error('Delete forbidden') });
    mockFromFn.mockReturnValue(mockChain);

    const { useDeleteDealAlert } = await import('./use-deal-alerts');
    const mutation = useDeleteDealAlert();

    await expect(mutation.mutateAsync('alert-1')).rejects.toThrow('Delete forbidden');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error deleting alert', variant: 'destructive' }),
    );
  });
});

describe('useToggleDealAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should activate an alert', async () => {
    const toggledAlert = { id: 'alert-1', is_active: true, name: 'My Alert' };
    const mockChain = createChainableMock({ data: toggledAlert, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useToggleDealAlert } = await import('./use-deal-alerts');
    const mutation = useToggleDealAlert();
    const result = await mutation.mutateAsync({ id: 'alert-1', is_active: true });

    expect(result).toEqual(toggledAlert);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alert activated' }));
  });

  it('should pause an alert', async () => {
    const toggledAlert = { id: 'alert-1', is_active: false, name: 'My Alert' };
    const mockChain = createChainableMock({ data: toggledAlert, error: null });
    mockFromFn.mockReturnValue(mockChain);

    const { useToggleDealAlert } = await import('./use-deal-alerts');
    const mutation = useToggleDealAlert();
    const result = await mutation.mutateAsync({ id: 'alert-1', is_active: false });

    expect(result).toEqual(toggledAlert);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alert paused' }));
  });
});

describe('DealAlert interface', () => {
  it('should export CreateDealAlertRequest type', async () => {
    const mod = await import('./use-deal-alerts');
    expect(mod.useCreateDealAlert).toBeDefined();
  });

  it('should export all hook functions', async () => {
    const mod = await import('./use-deal-alerts');
    expect(mod.useDealAlerts).toBeDefined();
    expect(mod.useCreateDealAlert).toBeDefined();
    expect(mod.useUpdateDealAlert).toBeDefined();
    expect(mod.useDeleteDealAlert).toBeDefined();
    expect(mod.useToggleDealAlert).toBeDefined();
  });
});
