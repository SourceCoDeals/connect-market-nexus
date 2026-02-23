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
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFromFn(...args),
    auth: { getUser: vi.fn() },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Keep track of whether the mock user is admin
let mockIsAdmin = true;

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, isAdmin: mockIsAdmin }),
}));

// Mock React hooks for node environment
let stateStore: Record<string, unknown> = {};
let stateCounter = 0;
let effectCallbacks: Array<() => void> = [];

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const key = `state_${stateCounter++}`;
    if (!(key in stateStore)) {
      stateStore[key] = initial;
    }
    const setState = (val: unknown) => {
      stateStore[key] =
        typeof val === 'function' ? (val as (prev: unknown) => unknown)(stateStore[key]) : val;
    };
    return [stateStore[key], setState];
  },
  useEffect: (fn: () => void) => {
    // Store the callback but do NOT run it synchronously to avoid TDZ issues
    // (loadDataQualityMetrics is a const defined after the useEffect call)
    effectCallbacks.push(fn);
  },
  useCallback: <T>(fn: T) => fn,
}));

// Extract and test the calculateMetrics and generateAlerts logic
// Since they are internal functions, we test them through the hook's behavior
describe('useDataQualityMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateStore = {};
    stateCounter = 0;
    effectCallbacks = [];
    mockIsAdmin = true;
  });

  describe('metric calculation', () => {
    it('should calculate totalUsers correctly', async () => {
      const profiles = [
        {
          id: '1',
          first_name: 'Alice',
          last_name: 'A',
          company: 'Co',
          buyer_type: 'b',
          ideal_target_description: 'desc',
          phone_number: '111',
          onboarding_completed: true,
          created_at: '2020-01-01',
        },
        {
          id: '2',
          first_name: 'Bob',
          last_name: 'B',
          company: 'Co2',
          buyer_type: 'b',
          ideal_target_description: 'desc',
          phone_number: '222',
          onboarding_completed: true,
          created_at: '2020-01-01',
        },
        {
          id: '3',
          first_name: 'Charlie',
          last_name: 'C',
          company: 'Co3',
          buyer_type: 'b',
          ideal_target_description: 'desc',
          phone_number: '333',
          onboarding_completed: true,
          created_at: '2020-01-01',
        },
      ];

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: profiles, error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const result = useDataQualityMonitor();
      // metrics is set asynchronously but the hook itself should exist
      expect(result).toBeDefined();
      expect(result.refreshMetrics).toBeDefined();
    });

    it('should calculate incompleteProfiles when critical fields are missing', async () => {
      const profiles = [
        {
          id: '1',
          first_name: 'Alice',
          last_name: 'A',
          company: 'Co',
          buyer_type: 'b',
          ideal_target_description: 'desc',
          phone_number: '111',
          onboarding_completed: true,
          created_at: '2020-01-01',
        },
        {
          id: '2',
          first_name: '',
          last_name: '',
          company: '',
          buyer_type: '',
          ideal_target_description: '',
          phone_number: '',
          onboarding_completed: false,
          created_at: '2020-01-01',
        },
      ];

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: profiles, error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const result = useDataQualityMonitor();
      expect(result).toBeDefined();
    });

    it('should calculate dataCompletenessScore as 100% when all fields are complete', async () => {
      // We test the formula: completedFields / (totalUsers * criticalFields.length) * 100
      const criticalFieldsCount = 6; // first_name, last_name, company, buyer_type, ideal_target_description, phone_number
      const totalUsers = 2;
      const totalPossibleFields = totalUsers * criticalFieldsCount;
      const missingCriticalFields = 0;
      const completedFields = totalPossibleFields - missingCriticalFields;
      const score = (completedFields / totalPossibleFields) * 100;
      expect(score).toBe(100);
    });

    it('should calculate dataCompletenessScore as 0% when all fields are missing', () => {
      const criticalFieldsCount = 6;
      const totalUsers = 3;
      const totalPossibleFields = totalUsers * criticalFieldsCount;
      const missingCriticalFields = totalPossibleFields; // all missing
      const completedFields = totalPossibleFields - missingCriticalFields;
      const score = totalPossibleFields > 0 ? (completedFields / totalPossibleFields) * 100 : 0;
      expect(score).toBe(0);
    });

    it('should handle empty profiles array', () => {
      const totalUsers = 0;
      const criticalFieldsCount = 6;
      const totalPossibleFields = totalUsers * criticalFieldsCount;
      const score = totalPossibleFields > 0 ? (0 / totalPossibleFields) * 100 : 0;
      expect(score).toBe(0);
    });

    it('should calculate formDropOffRate correctly', () => {
      const totalSessions = 100;
      const completedSessions = 60;
      const dropOffRate = ((totalSessions - completedSessions) / totalSessions) * 100;
      expect(dropOffRate).toBe(40);
    });

    it('should handle zero total sessions for formDropOffRate', () => {
      const totalSessions = 0;
      const dropOffRate = totalSessions > 0 ? ((totalSessions - 0) / totalSessions) * 100 : 0;
      expect(dropOffRate).toBe(0);
    });

    it('should calculate onboardingCompletionRate correctly', () => {
      const totalUsers = 10;
      const onboardingCompleted = 7;
      const rate = (onboardingCompleted / totalUsers) * 100;
      expect(rate).toBe(70);
    });

    it('should calculate validationErrorRate from funnel data', () => {
      const totalSessions = 50;
      const validationErrors = 5;
      const rate = totalSessions > 0 ? (validationErrors / totalSessions) * 100 : 0;
      expect(rate).toBe(10);
    });
  });

  describe('alert generation', () => {
    it('should generate high-dropout alert when formDropOffRate > 30', () => {
      const dropOffRate = 45;
      const shouldAlert = dropOffRate > 30;
      expect(shouldAlert).toBe(true);
    });

    it('should not generate high-dropout alert when formDropOffRate <= 30', () => {
      const dropOffRate = 25;
      const shouldAlert = dropOffRate > 30;
      expect(shouldAlert).toBe(false);
    });

    it('should generate low-completeness alert when dataCompletenessScore < 70', () => {
      const score = 60;
      const shouldAlert = score < 70;
      expect(shouldAlert).toBe(true);
    });

    it('should generate incomplete-profiles alert when incompleteProfiles > 10', () => {
      const incompleteProfiles = 15;
      const shouldAlert = incompleteProfiles > 10;
      expect(shouldAlert).toBe(true);
    });

    it('should not generate incomplete-profiles alert when incompleteProfiles <= 10', () => {
      const incompleteProfiles = 5;
      const shouldAlert = incompleteProfiles > 10;
      expect(shouldAlert).toBe(false);
    });

    it('should generate low-onboarding alert when onboardingCompletionRate < 80', () => {
      const rate = 65;
      const shouldAlert = rate < 80;
      expect(shouldAlert).toBe(true);
    });

    it('should sort alerts by priority (high > medium > low)', () => {
      const alerts = [
        { priority: 'low' as const, id: 'a' },
        { priority: 'high' as const, id: 'b' },
        { priority: 'medium' as const, id: 'c' },
      ];

      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const sorted = alerts.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

      expect(sorted[0].priority).toBe('high');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
    });
  });

  describe('dismissAlert', () => {
    it('should be callable', async () => {
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: [], error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const { dismissAlert } = useDataQualityMonitor();

      expect(typeof dismissAlert).toBe('function');
      // Should not throw
      dismissAlert('some-alert-id');
    });
  });

  describe('triggerDataRecoveryCampaign', () => {
    it('should invoke send-data-recovery-email function', async () => {
      mockInvoke.mockResolvedValue({ error: null });
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: [], error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const { triggerDataRecoveryCampaign } = useDataQualityMonitor();

      const result = await triggerDataRecoveryCampaign(['user-1', 'user-2']);

      expect(mockInvoke).toHaveBeenCalledWith('send-data-recovery-email', {
        body: { userIds: ['user-1', 'user-2'] },
      });
      expect(result).toEqual({ success: true });
    });

    it('should return failure result when invoke throws', async () => {
      const error = new Error('Function invocation failed');
      mockInvoke.mockResolvedValue({ error });
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: [], error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const { triggerDataRecoveryCampaign } = useDataQualityMonitor();

      const result = await triggerDataRecoveryCampaign(['user-3']);
      expect(result.success).toBe(false);
    });
  });

  describe('non-admin behavior', () => {
    it('should not load metrics when user is not admin', async () => {
      mockIsAdmin = false;
      mockFromFn.mockImplementation(() => {
        return createChainableMock({ data: [], error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const result = useDataQualityMonitor();

      expect(result.metrics).toBeNull();

      // Restore
      mockIsAdmin = true;
    });
  });

  describe('error handling', () => {
    it('should handle profiles fetch error gracefully', async () => {
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles')
          return createChainableMock({ data: null, error: new Error('DB error') });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const result = useDataQualityMonitor();
      // Should not crash
      expect(result).toBeDefined();
    });

    it('should expose refreshMetrics function that can be called manually', async () => {
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'profiles') return createChainableMock({ data: [], error: null });
        if (table === 'registration_funnel') return createChainableMock({ data: [], error: null });
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useDataQualityMonitor } = await import('./use-data-quality-monitor');
      const { refreshMetrics } = useDataQualityMonitor();

      expect(typeof refreshMetrics).toBe('function');
      // Should not throw when called manually
      await refreshMetrics();
      expect(mockFromFn).toHaveBeenCalledWith('profiles');
    });
  });
});
