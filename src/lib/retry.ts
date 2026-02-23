/**
 * Retry utility with exponential backoff.
 *
 * Provides a standalone `retryWithBackoff` function that can wrap any
 * async operation, retrying on failure with configurable exponential
 * backoff, jitter, and a caller-supplied retry predicate.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Initial delay in ms before the first retry (default: 1000). */
  initialDelay?: number;
  /** Upper-bound on delay between retries in ms (default: 30000). */
  maxDelay?: number;
  /** Multiplicative factor applied to delay after each retry (default: 2). */
  backoffFactor?: number;
  /** Optional predicate — return `false` to abort retrying for a given error. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Human-readable label used in log messages (default: "operation"). */
  operationName?: string;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30_000,
  backoffFactor: 2,
  shouldRetry: () => true,
  operationName: 'operation',
};

/**
 * Execute `fn` and retry up to `maxRetries` times on failure using
 * exponential backoff with jitter.
 *
 * @example
 * ```ts
 * const data = await retryWithBackoff(
 *   () => fetch('/api/deals').then(r => r.json()),
 *   { maxRetries: 5, operationName: 'fetchDeals' },
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.info(
          `[retry] Attempt ${attempt}/${opts.maxRetries} for "${opts.operationName}"`,
        );
      }

      const result = await fn();
      if (attempt > 0) {
        console.info(
          `[retry] "${opts.operationName}" succeeded on attempt ${attempt + 1}`,
        );
      }
      return result;
    } catch (error: unknown) {
      lastError = error;

      const message =
        error instanceof Error ? error.message : String(error);

      console.warn(
        `[retry] "${opts.operationName}" failed (attempt ${attempt + 1}/${opts.maxRetries + 1}): ${message}`,
      );

      // Check whether the caller wants to keep retrying
      if (!opts.shouldRetry(error, attempt)) {
        console.warn(
          `[retry] Retry aborted by shouldRetry predicate for "${opts.operationName}"`,
        );
        break;
      }

      // If we still have attempts left, wait before the next try
      if (attempt < opts.maxRetries) {
        const baseDelay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
          opts.maxDelay,
        );
        // Add up to 20 % jitter so concurrent callers don't thundering-herd
        const jitter = baseDelay * Math.random() * 0.2;
        const delay = Math.round(baseDelay + jitter);

        console.info(
          `[retry] Waiting ${delay}ms before next attempt for "${opts.operationName}"`,
        );

        await sleep(delay);
      }
    }
  }

  // All attempts exhausted
  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-built `shouldRetry` predicates for common scenarios.
 */
export const retryPredicates = {
  /** Only retry on network / fetch errors. */
  networkOnly(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout') ||
      error.name === 'TypeError' // fetch throws TypeError on network failure
    );
  },

  /** Only retry on HTTP 5xx status codes. */
  serverErrors(error: unknown): boolean {
    const status =
      (error as { status?: number })?.status ??
      (error as { response?: { status?: number } })?.response?.status;
    return typeof status === 'number' && status >= 500 && status < 600;
  },

  /** Retry on everything except authentication/authorization errors. */
  nonAuthErrors(error: unknown): boolean {
    if (!(error instanceof Error)) return true;
    const msg = error.message.toLowerCase();
    return (
      !msg.includes('unauthorized') &&
      !msg.includes('forbidden') &&
      !msg.includes('auth') &&
      !msg.includes('unauthenticated')
    );
  },
} as const;
