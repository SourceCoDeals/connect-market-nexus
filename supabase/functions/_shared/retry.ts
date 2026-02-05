// Shared: Retry Logic with Exponential Backoff
// Author: Phase 2 Architectural Consolidation
// Date: 2026-02-05

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * const result = await withRetry(() => callAPI(), {
 *   maxRetries: 3,
 *   baseDelay: 2000,
 *   onRetry: (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
 * });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 2000,
    maxDelay = 30000,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Calculate delay with exponential backoff: baseDelay * 2^attempt
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter (randomness) to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay; // ±30% jitter
      const finalDelay = delay + jitter;

      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);
      console.log(`[Retry] Waiting ${Math.round(finalDelay)}ms before retry...`);

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await sleep(finalDelay);
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableMessages = [
    'rate limit',
    'timeout',
    'network',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '429', // Too Many Requests
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Retry with circuit breaker pattern
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If circuit is open, check if we should try again
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure < this.resetTimeout) {
        throw new Error('Circuit breaker is OPEN - service is unavailable');
      }
      this.state = 'half-open';
    }

    try {
      const result = await fn();

      // Success - reset circuit breaker
      if (this.state === 'half-open') {
        console.log('[CircuitBreaker] Service recovered, closing circuit');
      }
      this.reset();

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.maxFailures) {
      this.state = 'open';
      console.error(`[CircuitBreaker] Circuit OPENED after ${this.failureCount} failures`);
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Retry with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
