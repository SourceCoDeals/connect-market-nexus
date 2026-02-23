import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockErrorHandler = vi.fn();
const mockLogError = vi.fn();

vi.mock('@/lib/error-handler', () => ({
  errorHandler: (...args: unknown[]) => mockErrorHandler(...args),
}));

vi.mock('@/lib/error-logger', () => ({
  errorLogger: {
    logError: (...args: unknown[]) => mockLogError(...args),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock React hooks for node environment
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (fn: () => void) => {
    fn();
  },
  useCallback: <T>(fn: T) => fn,
}));

describe('useProductionErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should call errorHandler with correct context', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('TestComponent');

      const error = new Error('Something went wrong');
      handleError(error, 'loading data', 'high');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        error,
        {
          component: 'TestComponent',
          operation: 'loading data',
          metadata: undefined,
        },
        'high',
      );
    });

    it('should call errorLogger.logError with correct parameters', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('MyComponent');

      const error = new Error('Test error');
      handleError(error, 'operation', 'medium');

      expect(mockLogError).toHaveBeenCalledWith(
        error,
        { component: 'MyComponent', operation: 'operation', metadata: undefined },
        'error',
      );
    });

    it('should map low severity to info level for errorLogger', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('LowSeverityComp');

      handleError('Minor issue', 'validation', 'low');

      expect(mockLogError).toHaveBeenCalledWith(
        'Minor issue',
        expect.objectContaining({ component: 'LowSeverityComp' }),
        'info',
      );
    });

    it('should map non-low severity to error level for errorLogger', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('HighSeverityComp');

      handleError(new Error('Critical'), 'save', 'critical');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ component: 'HighSeverityComp' }),
        'error',
      );
    });

    it('should use default severity of medium when not specified', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('DefaultComp');

      handleError(new Error('Default severity error'));

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ component: 'DefaultComp' }),
        'medium',
      );
    });

    it('should accept string errors', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('StringErrorComp');

      handleError('A string error message', 'task');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        'A string error message',
        expect.objectContaining({ component: 'StringErrorComp', operation: 'task' }),
        'medium',
      );
    });

    it('should pass metadata to context', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleError } = useProductionErrorHandler('MetadataComp');

      handleError(new Error('With metadata'), 'complex op', 'medium', {
        userId: 'u1',
        requestId: 'req-42',
      });

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        {
          component: 'MetadataComp',
          operation: 'complex op',
          metadata: { userId: 'u1', requestId: 'req-42' },
        },
        'medium',
      );
    });
  });

  describe('handleAsyncError', () => {
    it('should return result on successful async operation', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleAsyncError } = useProductionErrorHandler('AsyncComp');

      const result = await handleAsyncError(async () => 'success', 'async operation');

      expect(result).toBe('success');
      expect(mockErrorHandler).not.toHaveBeenCalled();
    });

    it('should call handleError and re-throw on async failure', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleAsyncError } = useProductionErrorHandler('AsyncFailComp');

      const error = new Error('Async operation failed');

      await expect(
        handleAsyncError(async () => {
          throw error;
        }, 'failing operation'),
      ).rejects.toThrow('Async operation failed');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ component: 'AsyncFailComp', operation: 'failing operation' }),
        'medium',
      );
    });

    it('should use specified severity for async errors', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleAsyncError } = useProductionErrorHandler('AsyncSeverityComp');

      await expect(
        handleAsyncError(
          async () => {
            throw new Error('High severity');
          },
          'critical op',
          'high',
        ),
      ).rejects.toThrow();

      expect(mockErrorHandler).toHaveBeenCalledWith(expect.any(Error), expect.any(Object), 'high');
    });
  });

  describe('handleNetworkError', () => {
    it('should call handleError with network-specific context', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleNetworkError } = useProductionErrorHandler('NetworkComp');

      handleNetworkError(new Error('Timeout'), '/api/users');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        new Error('Timeout'),
        {
          component: 'NetworkComp',
          operation: 'API call to /api/users',
          metadata: { type: 'network_error', endpoint: '/api/users' },
        },
        'medium',
      );
    });

    it('should handle string errors for network operations', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleNetworkError } = useProductionErrorHandler('NetStringComp');

      handleNetworkError('Connection refused', '/api/data');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        'Connection refused',
        expect.objectContaining({
          operation: 'API call to /api/data',
        }),
        'medium',
      );
    });

    it('should include extra metadata for network errors', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleNetworkError } = useProductionErrorHandler('NetMetaComp');

      handleNetworkError(new Error('CORS error'), '/api/external', {
        statusCode: 403,
        method: 'POST',
      });

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          metadata: {
            statusCode: 403,
            method: 'POST',
            type: 'network_error',
            endpoint: '/api/external',
          },
        }),
        'medium',
      );
    });
  });

  describe('handleFormError', () => {
    it('should call handleError with form-specific context and low severity', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleFormError } = useProductionErrorHandler('FormComp');

      handleFormError(new Error('Validation failed'), 'login');

      expect(mockErrorHandler).toHaveBeenCalledWith(
        new Error('Validation failed'),
        {
          component: 'FormComp',
          operation: 'login submission',
          metadata: { type: 'form_error', fieldErrors: undefined },
        },
        'low',
      );
    });

    it('should include field errors in metadata', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleFormError } = useProductionErrorHandler('FormFieldComp');

      handleFormError(new Error('Invalid form'), 'registration', {
        email: 'Invalid email',
        password: 'Too short',
      });

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          metadata: {
            type: 'form_error',
            fieldErrors: { email: 'Invalid email', password: 'Too short' },
          },
        }),
        'low',
      );
    });

    it('should use default form name when not specified', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const { handleFormError } = useProductionErrorHandler('DefaultFormComp');

      handleFormError(new Error('Error'));

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'form submission' }),
        'low',
      );
    });
  });

  describe('component name binding', () => {
    it('should use the provided component name in all handlers', async () => {
      const { useProductionErrorHandler } = await import('./use-production-error-handler');
      const handler = useProductionErrorHandler('SpecialComponent');

      handler.handleError(new Error('e1'));
      handler.handleNetworkError(new Error('e2'), '/api');
      handler.handleFormError(new Error('e3'));

      const calls = mockErrorHandler.mock.calls;
      expect(calls).toHaveLength(3);
      expect(calls[0][1].component).toBe('SpecialComponent');
      expect(calls[1][1].component).toBe('SpecialComponent');
      expect(calls[2][1].component).toBe('SpecialComponent');
    });
  });
});
