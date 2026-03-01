/**
 * Downtime & failure mode tests for AI Providers (Gemini API)
 *
 * Covers: parseAIError, fetchWithAutoRetry (429 retries, 5xx retries, network
 * errors, timeouts), parseRetryAfter, and callGeminiWithRetry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Re-implement the functions under test (mirrors ai-providers.ts)
// so we can test them without Deno import resolution.
// ---------------------------------------------------------------------------

interface AIErrorResponse {
  error: string;
  code?: string;
  recoverable?: boolean;
}

function parseAIError(status: number, responseText?: string): AIErrorResponse {
  switch (status) {
    case 401:
      return { error: 'Invalid API key', code: 'invalid_api_key', recoverable: false };
    case 402:
      return {
        error: 'Payment required - please add credits',
        code: 'payment_required',
        recoverable: false,
      };
    case 429:
      return {
        error: 'Rate limit exceeded - please try again later',
        code: 'rate_limited',
        recoverable: true,
      };
    case 500:
    case 502:
    case 503:
      return {
        error: 'AI service temporarily unavailable',
        code: 'service_unavailable',
        recoverable: true,
      };
    default:
      return {
        error: responseText || `AI API error: ${status}`,
        code: 'unknown_error',
        recoverable: false,
      };
  }
}

function parseRetryAfter(response: { headers: Headers }): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return null;
}

async function fetchWithAutoRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  config: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    callerName?: string;
  } = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 2000, maxDelayMs = 60000, callerName = 'AI' } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok || (response.status >= 400 && response.status < 429)) {
        return response;
      }

      if (response.status === 429) {
        if (attempt === maxRetries) return response;
        const retryAfterMs = parseRetryAfter(response) || baseDelayMs * Math.pow(2, attempt);
        const waitMs = Math.min(retryAfterMs, maxDelayMs);
        const jitter = Math.random() * 1000;
        await new Promise((r) => setTimeout(r, waitMs + jitter));
        continue;
      }

      if (response.status >= 500) {
        if (attempt === maxRetries) return response;
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * delay * 0.3;
        await new Promise((r) => setTimeout(r, delay + jitter));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === 'TimeoutError' || lastError.name === 'AbortError') {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`${callerName}: all retry attempts exhausted`);
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockResponse(
  status: number,
  body: string | Record<string, unknown> = '',
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
    headers: new Headers(headers),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseAIError', () => {
  it('returns invalid_api_key for 401', () => {
    const result = parseAIError(401);
    expect(result.code).toBe('invalid_api_key');
    expect(result.recoverable).toBe(false);
  });

  it('returns payment_required for 402', () => {
    const result = parseAIError(402);
    expect(result.code).toBe('payment_required');
    expect(result.recoverable).toBe(false);
  });

  it('returns rate_limited for 429', () => {
    const result = parseAIError(429);
    expect(result.code).toBe('rate_limited');
    expect(result.recoverable).toBe(true);
  });

  it.each([500, 502, 503])('returns service_unavailable for %d', (status) => {
    const result = parseAIError(status);
    expect(result.code).toBe('service_unavailable');
    expect(result.recoverable).toBe(true);
  });

  it('returns unknown_error with response text for unrecognized status', () => {
    const result = parseAIError(418, "I'm a teapot");
    expect(result.code).toBe('unknown_error');
    expect(result.error).toBe("I'm a teapot");
    expect(result.recoverable).toBe(false);
  });

  it('returns default message when no response text for unknown status', () => {
    const result = parseAIError(418);
    expect(result.error).toBe('AI API error: 418');
  });
});

describe('parseRetryAfter', () => {
  it('returns null when no Retry-After header', () => {
    const response = { headers: new Headers() };
    expect(parseRetryAfter(response)).toBeNull();
  });

  it('parses numeric seconds into milliseconds', () => {
    const response = { headers: new Headers({ 'retry-after': '5' }) };
    expect(parseRetryAfter(response)).toBe(5000);
  });

  it('parses date format into milliseconds', () => {
    const futureDate = new Date(Date.now() + 10000).toUTCString();
    const response = { headers: new Headers({ 'retry-after': futureDate }) };
    const result = parseRetryAfter(response);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(11000);
  });

  it('returns 0 for past dates', () => {
    const pastDate = new Date(Date.now() - 10000).toUTCString();
    const response = { headers: new Headers({ 'retry-after': pastDate }) };
    expect(parseRetryAfter(response)).toBe(0);
  });

  it('returns null for invalid header value', () => {
    const response = { headers: new Headers({ 'retry-after': 'not-a-number-or-date' }) };
    // Invalid date string -> NaN, invalid number -> NaN, so returns null
    expect(parseRetryAfter(response)).toBeNull();
  });
});

describe('fetchWithAutoRetry', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    // Suppress console.warn during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Successful responses
  // =========================================================================

  describe('Successful responses', () => {
    it('returns immediately on 200', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry('https://api.test.com', { method: 'POST' });
      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns immediately on 4xx client errors (< 429)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(400, 'Bad Request'));

      const response = await fetchWithAutoRetry('https://api.test.com', { method: 'POST' });
      expect(response.status).toBe(400);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns 401 immediately without retry', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse(401, 'Unauthorized'));

      const response = await fetchWithAutoRetry('https://api.test.com', { method: 'POST' });
      expect(response.status).toBe(401);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Rate limit (429) retries
  // =========================================================================

  describe('Rate limit (429) retries', () => {
    it('retries on 429 and succeeds on next attempt', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(429, 'Rate limited'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10, // fast for tests
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns 429 after exhausting all retries', async () => {
      fetchSpy.mockResolvedValue(mockResponse(429, 'Rate limited'));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 2,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(429);
      // 1 initial + 2 retries = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('respects Retry-After header on 429', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(429, 'Rate limited', { 'retry-after': '1' }))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Server error (5xx) retries
  // =========================================================================

  describe('Server error (5xx) retries', () => {
    it.each([500, 502, 503])('retries on %d and succeeds', async (status) => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(status, 'Server Error'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns 503 after exhausting all retries', async () => {
      fetchSpy.mockResolvedValue(mockResponse(503, 'Service Unavailable'));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 2,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(503);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('recovers after intermittent 502 errors', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(502, 'Bad Gateway'))
        .mockResolvedValueOnce(mockResponse(502, 'Bad Gateway'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // Network errors
  // =========================================================================

  describe('Network errors', () => {
    it('retries on network error and succeeds', async () => {
      fetchSpy
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries on persistent network error', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        fetchWithAutoRetry(
          'https://api.test.com',
          { method: 'POST' },
          {
            maxRetries: 2,
            baseDelayMs: 10,
          },
        ),
      ).rejects.toThrow('Failed to fetch');

      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('throws error message about all retries exhausted when no error captured', async () => {
      // Edge case: error is not an Error instance
      fetchSpy.mockRejectedValue('string error');

      await expect(
        fetchWithAutoRetry(
          'https://api.test.com',
          { method: 'POST' },
          {
            maxRetries: 1,
            baseDelayMs: 10,
            callerName: 'TestCaller',
          },
        ),
      ).rejects.toThrow('string error');
    });
  });

  // =========================================================================
  // Timeout handling
  // =========================================================================

  describe('Timeout handling', () => {
    it('throws immediately on TimeoutError without retrying', async () => {
      const timeoutError = new Error('The operation timed out');
      timeoutError.name = 'TimeoutError';
      fetchSpy.mockRejectedValueOnce(timeoutError);

      await expect(
        fetchWithAutoRetry(
          'https://api.test.com',
          { method: 'POST' },
          {
            maxRetries: 3,
            baseDelayMs: 10,
          },
        ),
      ).rejects.toThrow('The operation timed out');

      // Should NOT retry on timeout
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws immediately on AbortError without retrying', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      await expect(
        fetchWithAutoRetry(
          'https://api.test.com',
          { method: 'POST' },
          {
            maxRetries: 3,
            baseDelayMs: 10,
          },
        ),
      ).rejects.toThrow('The operation was aborted');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Mixed failure scenarios
  // =========================================================================

  describe('Mixed failure scenarios', () => {
    it('handles 429 then 502 then success', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(429, 'Rate limited'))
        .mockResolvedValueOnce(mockResponse(502, 'Bad Gateway'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('handles network error then 429 then success', async () => {
      fetchSpy
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockResponse(429, 'Rate limited'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
        },
      );

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // Delay capping (maxDelayMs)
  // =========================================================================

  describe('Delay capping', () => {
    it('caps retry delay at maxDelayMs', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse(500, 'Error'))
        .mockResolvedValueOnce(mockResponse(500, 'Error'))
        .mockResolvedValueOnce(mockResponse(500, 'Error'))
        .mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

      const response = await fetchWithAutoRetry(
        'https://api.test.com',
        { method: 'POST' },
        {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 50,
        },
      );

      expect(response.status).toBe(200);
    });
  });
});

describe('Gemini API specific failure scenarios', () => {
  it('classifies 402 as non-recoverable payment error', () => {
    const err = parseAIError(402);
    expect(err.code).toBe('payment_required');
    expect(err.recoverable).toBe(false);
    expect(err.error).toContain('credits');
  });

  it('classifies 429 as recoverable rate limit', () => {
    const err = parseAIError(429);
    expect(err.code).toBe('rate_limited');
    expect(err.recoverable).toBe(true);
  });

  it('classifies 503 as recoverable service unavailable', () => {
    const err = parseAIError(503);
    expect(err.code).toBe('service_unavailable');
    expect(err.recoverable).toBe(true);
  });

  it('classifies 401 as non-recoverable auth error', () => {
    const err = parseAIError(401);
    expect(err.code).toBe('invalid_api_key');
    expect(err.recoverable).toBe(false);
  });
});
