/**
 * Retry utility with exponential backoff for edge functions.
 * Use this for all external API calls (LinkedIn, financial data, web scraping, AI APIs).
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxRetries) break;

      // Check if error is retryable
      if (opts.retryableErrors?.length) {
        const isRetryable = opts.retryableErrors.some((e) => lastError!.message.includes(e));
        if (!isRetryable) break;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelayMs,
      );

      console.log(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms: ${lastError.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
