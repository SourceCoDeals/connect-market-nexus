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
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFromFn(...args),
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

const mockUser = { id: 'user-123', email: 'test@example.com' };

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAdmin: false }),
}));

// Mock React hooks for node environment
let stateStore: Record<string, unknown> = {};
let stateCounter = 0;

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
    fn();
  },
  useCallback: <T>(fn: T) => fn,
}));

describe('useEnhancedFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateStore = {};
    stateCounter = 0;
    mockInvoke.mockResolvedValue({ error: null });
  });

  describe('submitFeedback', () => {
    it('should submit feedback successfully with all fields', async () => {
      const feedbackRecord = {
        id: 'feedback-1',
        user_id: 'user-123',
        message: 'Great product!',
        category: 'general',
        priority: 'normal',
        status: 'unread',
      };

      // First call: insert into feedback_messages
      const insertChain = createChainableMock({ data: feedbackRecord, error: null });
      // Second call: select from profiles
      const profileChain = createChainableMock({
        data: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
        error: null,
      });

      const _callCount = 0;
      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') return insertChain;
        if (table === 'profiles') return profileChain;
        return createChainableMock({ data: null, error: null });
      });

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      const result = await submitFeedback({
        message: 'Great product!',
        category: 'general',
        priority: 'normal',
      });

      expect(mockFromFn).toHaveBeenCalledWith('feedback_messages');
      expect(result).toEqual(feedbackRecord);
    });

    it('should throw error when message is empty', async () => {
      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await expect(submitFeedback({ message: '' })).rejects.toThrow('Message is required');

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Message required' }),
      );
    });

    it('should throw error when message is only whitespace', async () => {
      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await expect(submitFeedback({ message: '   ' })).rejects.toThrow('Message is required');
    });

    it('should throw error when user is not authenticated', async () => {
      // Override useAuth to return null user
      vi.doMock('@/context/AuthContext', () => ({
        useAuth: () => ({ user: null, isAdmin: false }),
      }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await expect(submitFeedback({ message: 'Hello' })).rejects.toThrow(
        'User must be authenticated to submit feedback',
      );

      // Restore the mock
      vi.doMock('@/context/AuthContext', () => ({
        useAuth: () => ({ user: mockUser, isAdmin: false }),
      }));
    });

    it('should use default category "general" when none provided', async () => {
      const feedbackRecord = { id: 'f1', category: 'general' };
      const insertChain = createChainableMock({ data: feedbackRecord, error: null });
      const profileChain = createChainableMock({
        data: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
        error: null,
      });

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') return insertChain;
        if (table === 'profiles') return profileChain;
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      const result = await submitFeedback({ message: 'Hello world' });
      expect(result).toBeDefined();
    });

    it('should handle database insert error', async () => {
      const insertChain = createChainableMock({
        data: null,
        error: { message: 'Insert failed: row too large' },
      });
      mockFromFn.mockReturnValue(insertChain);

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await expect(submitFeedback({ message: 'Some feedback', category: 'bug' })).rejects.toThrow(
        'Database error',
      );

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Submission failed' }),
      );
    });

    it('should handle null data returned from insert', async () => {
      const insertChain = createChainableMock({ data: null, error: null });
      mockFromFn.mockReturnValue(insertChain);

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await expect(submitFeedback({ message: 'Some feedback' })).rejects.toThrow(
        'Failed to save feedback - no data returned',
      );
    });

    it('should show category-specific success toast for bug reports', async () => {
      const feedbackRecord = { id: 'f1', category: 'bug' };
      const insertChain = createChainableMock({ data: feedbackRecord, error: null });
      const profileChain = createChainableMock({
        data: { first_name: 'Test', last_name: 'User', email: 'test@test.com' },
        error: null,
      });

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') return insertChain;
        if (table === 'profiles') return profileChain;
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await submitFeedback({ message: 'Found a bug', category: 'bug' });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Bug report submitted!' }),
      );
    });

    it('should show category-specific success toast for contact messages', async () => {
      const feedbackRecord = { id: 'f2', category: 'contact' };
      const insertChain = createChainableMock({ data: feedbackRecord, error: null });
      const profileChain = createChainableMock({
        data: { first_name: 'Test', last_name: 'User', email: 'test@test.com' },
        error: null,
      });

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') return insertChain;
        if (table === 'profiles') return profileChain;
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      await submitFeedback({ message: 'Hello', category: 'contact' });

      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Message sent!' }));
    });

    it('should gracefully handle email sending failure', async () => {
      const feedbackRecord = { id: 'f3', category: 'general' };
      const insertChain = createChainableMock({ data: feedbackRecord, error: null });
      const profileChain = createChainableMock({
        data: { first_name: 'Test', last_name: 'User', email: 'test@test.com' },
        error: null,
      });

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') return insertChain;
        if (table === 'profiles') return profileChain;
        return createChainableMock({ data: null, error: null });
      });

      // Make email function fail
      mockInvoke.mockResolvedValueOnce({ error: new Error('Email service down') });
      mockInvoke.mockResolvedValueOnce({ error: null }); // admin notification

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { submitFeedback } = useEnhancedFeedback();

      // Should NOT throw even though email failed
      const result = await submitFeedback({ message: 'Test feedback' });
      expect(result).toBeDefined();
    });
  });

  describe('getFeedbackWithUserDetails', () => {
    it('should merge feedback messages with user profiles', async () => {
      const messages = [
        { id: 'm1', user_id: 'u1', message: 'Hello', category: 'general' },
        { id: 'm2', user_id: 'u2', message: 'Bug report', category: 'bug' },
      ];
      const profiles = [
        {
          id: 'u1',
          email: 'user1@test.com',
          first_name: 'Alice',
          last_name: 'A',
          company: 'Co1',
          phone_number: '111',
        },
        {
          id: 'u2',
          email: 'user2@test.com',
          first_name: 'Bob',
          last_name: 'B',
          company: 'Co2',
          phone_number: '222',
        },
      ];

      mockFromFn.mockImplementation((table: string) => {
        if (table === 'feedback_messages') {
          return createChainableMock({ data: messages, error: null });
        }
        if (table === 'profiles') {
          return createChainableMock({ data: profiles, error: null });
        }
        return createChainableMock({ data: null, error: null });
      });

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { getFeedbackWithUserDetails } = useEnhancedFeedback();

      const result = await getFeedbackWithUserDetails();
      expect(result).toHaveLength(2);
      expect(result[0].user_email).toBe('user1@test.com');
      expect(result[1].user_first_name).toBe('Bob');
    });

    it('should return empty array on error', async () => {
      mockFromFn.mockReturnValue(
        createChainableMock({ data: null, error: new Error('Query failed') }),
      );

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { getFeedbackWithUserDetails } = useEnhancedFeedback();

      const result = await getFeedbackWithUserDetails();
      expect(result).toEqual([]);
    });
  });

  describe('getFeedbackHistory', () => {
    it('should fetch feedback for authenticated user', async () => {
      const userFeedback = [{ id: 'f1', user_id: 'user-123', message: 'My feedback' }];
      mockFromFn.mockReturnValue(createChainableMock({ data: userFeedback, error: null }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { getFeedbackHistory } = useEnhancedFeedback();

      const result = await getFeedbackHistory();
      expect(result).toEqual(userFeedback);
    });

    it('should return empty array when no user is authenticated', async () => {
      vi.doMock('@/context/AuthContext', () => ({
        useAuth: () => ({ user: null, isAdmin: false }),
      }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { getFeedbackHistory } = useEnhancedFeedback();

      const result = await getFeedbackHistory();
      expect(result).toEqual([]);

      // Restore
      vi.doMock('@/context/AuthContext', () => ({
        useAuth: () => ({ user: mockUser, isAdmin: false }),
      }));
    });

    it('should return empty array on database error', async () => {
      mockFromFn.mockReturnValue(createChainableMock({ data: null, error: new Error('DB error') }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { getFeedbackHistory } = useEnhancedFeedback();

      const result = await getFeedbackHistory();
      expect(result).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read by admin', async () => {
      mockFromFn.mockReturnValue(createChainableMock({ data: null, error: null }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { markAsRead } = useEnhancedFeedback();

      await markAsRead('msg-1', false);
      expect(mockFromFn).toHaveBeenCalledWith('feedback_messages');
    });

    it('should mark message as read by user', async () => {
      mockFromFn.mockReturnValue(createChainableMock({ data: null, error: null }));

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { markAsRead } = useEnhancedFeedback();

      await markAsRead('msg-1', true);
      expect(mockFromFn).toHaveBeenCalledWith('feedback_messages');
    });

    it('should handle mark as read error gracefully', async () => {
      mockFromFn.mockReturnValue(
        createChainableMock({ data: null, error: new Error('Update failed') }),
      );

      vi.resetModules();
      stateStore = {};
      stateCounter = 0;

      const { useEnhancedFeedback } = await import('./use-enhanced-feedback');
      const { markAsRead } = useEnhancedFeedback();

      // Should not throw
      await markAsRead('msg-1');
    });
  });
});
