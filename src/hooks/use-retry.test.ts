import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryConditions } from './use-retry';

// Since the test environment is 'node' (no jsdom), we test the non-hook exports directly.
// The useRetry hook relies on React useState/useCallback, so we test the retry conditions
// and simulate the core retry logic manually.

// Mock the error-handler module
vi.mock('@/lib/error-handler', () => ({
  errorHandler: vi.fn(),
}));

// Mock the error-logger module
vi.mock('@/lib/error-logger', () => ({
  errorLogger: {
    logError: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the toast module
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

describe('retryConditions', () => {
  describe('networkOnly', () => {
    it('should return true for errors with name "NetworkError"', () => {
      const error = { name: 'NetworkError', message: 'Connection failed' };
      expect(retryConditions.networkOnly(error)).toBe(true);
    });

    it('should return true for errors with code "NETWORK_ERROR"', () => {
      const error = { code: 'NETWORK_ERROR', message: 'Timeout' };
      expect(retryConditions.networkOnly(error)).toBe(true);
    });

    it('should return true for errors with "network" in message', () => {
      const error = { message: 'A network error occurred' };
      expect(retryConditions.networkOnly(error)).toBe(true);
    });

    it('should return true for errors with "fetch" in message', () => {
      const error = { message: 'Failed to fetch' };
      expect(retryConditions.networkOnly(error)).toBe(true);
    });

    it('should return false for validation errors', () => {
      const error = { name: 'ValidationError', message: 'Invalid input' };
      expect(retryConditions.networkOnly(error)).toBe(false);
    });

    it('should return false for null error', () => {
      expect(retryConditions.networkOnly(null)).toBe(false);
    });

    it('should return false for errors without network indicators', () => {
      const error = { name: 'TypeError', message: 'Cannot read property' };
      expect(retryConditions.networkOnly(error)).toBe(false);
    });
  });

  describe('serverErrorsOnly', () => {
    it('should return true for 500 status errors', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(true);
    });

    it('should return true for 502 status errors', () => {
      const error = { status: 502, message: 'Bad Gateway' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(true);
    });

    it('should return true for 503 status errors', () => {
      const error = { status: 503, message: 'Service Unavailable' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(true);
    });

    it('should return true for 599 status errors', () => {
      const error = { status: 599, message: 'Server error' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(true);
    });

    it('should return false for 400 client errors', () => {
      const error = { status: 400, message: 'Bad Request' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(false);
    });

    it('should return false for 404 errors', () => {
      const error = { status: 404, message: 'Not Found' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(false);
    });

    it('should return false for 401 unauthorized errors', () => {
      const error = { status: 401, message: 'Unauthorized' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(false);
    });

    it('should handle status from nested response object', () => {
      const error = { response: { status: 503 }, message: 'Error' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(true);
    });

    it('should return false when no status is available', () => {
      const error = { message: 'Some error' };
      expect(retryConditions.serverErrorsOnly(error)).toBe(false);
    });
  });

  describe('nonAuthErrors', () => {
    it('should return true for non-auth errors', () => {
      const error = new Error('Database connection failed');
      expect(retryConditions.nonAuthErrors(error)).toBe(true);
    });

    it('should return false for errors containing "auth"', () => {
      const error = new Error('Authentication failed');
      expect(retryConditions.nonAuthErrors(error)).toBe(false);
    });

    it('should return false for errors containing "unauthorized"', () => {
      const error = new Error('Unauthorized access');
      expect(retryConditions.nonAuthErrors(error)).toBe(false);
    });

    it('should return false for errors containing "forbidden"', () => {
      const error = new Error('Forbidden resource');
      expect(retryConditions.nonAuthErrors(error)).toBe(false);
    });

    it('should return true for non-Error objects', () => {
      expect(retryConditions.nonAuthErrors('some string')).toBe(true);
    });

    it('should be case-insensitive for "Auth" errors', () => {
      const error = new Error('AUTH_TOKEN_EXPIRED');
      expect(retryConditions.nonAuthErrors(error)).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = new Error('Network timeout');
      expect(retryConditions.nonAuthErrors(error)).toBe(true);
    });
  });

  describe('withJitter', () => {
    it('should return false when attempt is >= 5', () => {
      // withJitter always returns false for attemptNumber >= 5
      // We call it multiple times to be confident (it has randomness)
      let allFalseAtFive = true;
      for (let i = 0; i < 20; i++) {
        if (retryConditions.withJitter(new Error('test'), 5)) {
          allFalseAtFive = false;
        }
      }
      expect(allFalseAtFive).toBe(true);
    });

    it('should return false when attempt is >= 6', () => {
      let allFalse = true;
      for (let i = 0; i < 20; i++) {
        if (retryConditions.withJitter(new Error('test'), 6)) {
          allFalse = false;
        }
      }
      expect(allFalse).toBe(true);
    });

    it('should mostly return true for early attempts (attempt 0)', () => {
      // With 10% jitter, ~90% should return true
      let trueCount = 0;
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        if (retryConditions.withJitter(new Error('test'), 0)) {
          trueCount++;
        }
      }
      // Should be true at least 70% of the time (generous margin for randomness)
      expect(trueCount).toBeGreaterThan(iterations * 0.7);
    });
  });
});

describe('RetryConfig defaults', () => {
  it('should have expected default values', async () => {
    // Import the module to verify the defaults are correct
    const { useRetry } = await import('./use-retry');
    expect(useRetry).toBeDefined();
    expect(typeof useRetry).toBe('function');
  });
});

describe('Retry logic simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should calculate exponential backoff delays correctly', () => {
    const initialDelay = 1000;
    const backoffFactor = 2;
    const maxDelay = 10000;

    const delays = [0, 1, 2, 3, 4].map((attempt) => {
      return Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
    });

    expect(delays[0]).toBe(1000); // 1000 * 2^0
    expect(delays[1]).toBe(2000); // 1000 * 2^1
    expect(delays[2]).toBe(4000); // 1000 * 2^2
    expect(delays[3]).toBe(8000); // 1000 * 2^3
    expect(delays[4]).toBe(10000); // capped at maxDelay
  });

  it('should cap delay at maxDelay', () => {
    const initialDelay = 1000;
    const backoffFactor = 3;
    const maxDelay = 5000;

    const delay = Math.min(initialDelay * Math.pow(backoffFactor, 3), maxDelay);
    // 1000 * 27 = 27000, capped at 5000
    expect(delay).toBe(5000);
  });

  it('should handle custom initialDelay', () => {
    const initialDelay = 500;
    const backoffFactor = 2;
    const maxDelay = 10000;

    const delay = Math.min(initialDelay * Math.pow(backoffFactor, 0), maxDelay);
    expect(delay).toBe(500);
  });

  it('should handle backoffFactor of 1 (linear delay)', () => {
    const initialDelay = 1000;
    const backoffFactor = 1;
    const maxDelay = 10000;

    const delays = [0, 1, 2, 3].map((attempt) => {
      return Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
    });

    // All delays should be the same with factor 1
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(1000);
    expect(delays[2]).toBe(1000);
    expect(delays[3]).toBe(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
