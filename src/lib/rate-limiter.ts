/**
 * rate-limiter.ts — Client-side rate limiting utilities
 *
 * Provides a token bucket rate limiter for API calls and a debounced
 * submission handler to prevent double-submits. These are client-side
 * guards — always pair with server-side rate limiting for real security.
 */

// ---------------------------------------------------------------------------
// Token Bucket Rate Limiter
// ---------------------------------------------------------------------------

interface RateLimiterConfig {
  /** Maximum number of tokens (requests) in the bucket */
  maxTokens: number;
  /** How many tokens to refill per interval */
  refillRate: number;
  /** Refill interval in milliseconds */
  refillIntervalMs: number;
}

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

/**
 * A client-side token bucket rate limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxTokens: 10, refillRate: 1, refillIntervalMs: 1000 });
 *   if (limiter.tryConsume()) { // make API call }
 *   else { // show "too many requests" message }
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const { maxTokens, refillRate, refillIntervalMs } = config;

  const state: RateLimiterState = {
    tokens: maxTokens,
    lastRefill: Date.now(),
  };

  function refill(): void {
    const now = Date.now();
    const elapsed = now - state.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / refillIntervalMs);

    if (intervalsElapsed > 0) {
      state.tokens = Math.min(maxTokens, state.tokens + intervalsElapsed * refillRate);
      state.lastRefill = now;
    }
  }

  return {
    /**
     * Try to consume a token. Returns true if allowed, false if rate limited.
     */
    tryConsume(count = 1): boolean {
      refill();
      if (state.tokens >= count) {
        state.tokens -= count;
        return true;
      }
      return false;
    },

    /**
     * Check how many tokens are available without consuming.
     */
    getAvailableTokens(): number {
      refill();
      return state.tokens;
    },

    /**
     * Get estimated milliseconds until a token will be available.
     */
    getRetryAfterMs(): number {
      refill();
      if (state.tokens > 0) return 0;
      const deficit = 1 - state.tokens;
      return Math.ceil((deficit / refillRate) * refillIntervalMs);
    },

    /**
     * Reset the rate limiter to full capacity.
     */
    reset(): void {
      state.tokens = maxTokens;
      state.lastRefill = Date.now();
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-configured Rate Limiters
// ---------------------------------------------------------------------------

/** General API call limiter: 30 requests per 10 seconds */
export const apiRateLimiter = createRateLimiter({
  maxTokens: 30,
  refillRate: 3,
  refillIntervalMs: 1000,
});

/** Auth action limiter: 5 attempts per 60 seconds */
export const authRateLimiter = createRateLimiter({
  maxTokens: 5,
  refillRate: 1,
  refillIntervalMs: 12000,
});

/** Search/filter limiter: 10 requests per 5 seconds */
export const searchRateLimiter = createRateLimiter({
  maxTokens: 10,
  refillRate: 2,
  refillIntervalMs: 1000,
});

// ---------------------------------------------------------------------------
// Debounced Submission Handler
// ---------------------------------------------------------------------------

interface SubmissionState {
  isSubmitting: boolean;
  lastSubmitTime: number;
}

/**
 * Creates a debounced submission handler to prevent double-submits.
 *
 * Features:
 * - Prevents concurrent submissions (isSubmitting guard)
 * - Enforces minimum interval between submissions
 * - Integrates with optional rate limiter
 *
 * Usage:
 *   const submit = createDebouncedSubmission(async (data) => {
 *     await api.post('/endpoint', data);
 *   }, { minIntervalMs: 2000 });
 *
 *   // In your form handler:
 *   const result = await submit(formData);
 *   if (!result.allowed) { toast.error(result.reason); }
 */
export function createDebouncedSubmission<T, R>(
  handler: (data: T) => Promise<R>,
  options: {
    /** Minimum milliseconds between submissions (default: 1000) */
    minIntervalMs?: number;
    /** Optional rate limiter to check before submitting */
    rateLimiter?: ReturnType<typeof createRateLimiter>;
  } = {}
) {
  const { minIntervalMs = 1000, rateLimiter } = options;

  const state: SubmissionState = {
    isSubmitting: false,
    lastSubmitTime: 0,
  };

  return async function debouncedSubmit(
    data: T
  ): Promise<{ allowed: true; result: R } | { allowed: false; reason: string }> {
    // Guard: already submitting
    if (state.isSubmitting) {
      return { allowed: false, reason: 'A submission is already in progress.' };
    }

    // Guard: too soon since last submission
    const now = Date.now();
    const timeSinceLast = now - state.lastSubmitTime;
    if (timeSinceLast < minIntervalMs) {
      const waitMs = minIntervalMs - timeSinceLast;
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(waitMs / 1000)} second(s) before submitting again.`,
      };
    }

    // Guard: rate limiter
    if (rateLimiter && !rateLimiter.tryConsume()) {
      const retryAfter = rateLimiter.getRetryAfterMs();
      return {
        allowed: false,
        reason: `Too many requests. Please wait ${Math.ceil(retryAfter / 1000)} second(s).`,
      };
    }

    state.isSubmitting = true;
    state.lastSubmitTime = now;

    try {
      const result = await handler(data);
      return { allowed: true, result };
    } finally {
      state.isSubmitting = false;
    }
  };
}

// ---------------------------------------------------------------------------
// Utility: Rate-Limited Fetch Wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps the Fetch API with rate limiting.
 * Falls back to standard fetch if the limiter allows the request.
 */
export async function rateLimitedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  limiter: ReturnType<typeof createRateLimiter> = apiRateLimiter
): Promise<Response> {
  if (!limiter.tryConsume()) {
    const retryAfter = limiter.getRetryAfterMs();
    throw new Error(
      `Rate limited. Please retry after ${Math.ceil(retryAfter / 1000)} second(s).`
    );
  }

  return fetch(input, init);
}
