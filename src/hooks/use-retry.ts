import { useState, useCallback } from 'react';
import { errorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

/**
 * Configuration options for the retry mechanism.
 *
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in ms before the first retry (default: 1000)
 * @param maxDelay - Maximum delay cap in ms between retries (default: 10000)
 * @param backoffFactor - Multiplier applied to the delay on each subsequent retry (default: 2)
 * @param retryCondition - Predicate that determines whether a given error should trigger a retry
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: unknown, attemptNumber: number) => boolean;
}

export interface RetryState {
  isRetrying: boolean;
  currentAttempt: number;
  lastError: Error | null;
  canRetry: boolean;
}

const defaultConfig: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: () => true,
};

/**
 * Hook that wraps an async function with configurable retry logic and exponential backoff.
 *
 * @param asyncFn - The async function to wrap with retry behavior
 * @param config - Optional retry configuration (maxRetries, delays, backoff, retry condition)
 * @returns An object with `execute` (the retried function), `state` (current retry state), and `reset`
 *
 * @example
 * ```ts
 * const { execute, state } = useRetry(fetchData, { maxRetries: 3, initialDelay: 500 });
 * await execute(userId);
 * ```
 */
export function useRetry<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>,
  config: RetryConfig = {},
) {
  const finalConfig = { ...defaultConfig, ...config };

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: 0,
    lastError: null,
    canRetry: true,
  });

  const executeWithRetry = useCallback(
    async (...args: T): Promise<R> => {
      setState((prev) => ({
        ...prev,
        isRetrying: true,
        currentAttempt: 0,
        lastError: null,
        canRetry: true,
      }));

      let lastError: Error = new Error('All retries failed');

      for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
          setState((prev) => ({ ...prev, currentAttempt: attempt + 1 }));

          const result = await asyncFn(...args);

          // Success - reset state
          setState({
            isRetrying: false,
            currentAttempt: 0,
            lastError: null,
            canRetry: true,
          });

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          logger.warn(
            `Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} failed: ${lastError.message}`,
            'useRetry',
          );

          // Check if we should retry this error
          if (!finalConfig.retryCondition(lastError, attempt)) {
            break;
          }

          // If this wasn't the last attempt, wait before retrying
          if (attempt < finalConfig.maxRetries) {
            const delay = Math.min(
              finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt),
              finalConfig.maxDelay,
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed
      setState({
        isRetrying: false,
        currentAttempt: finalConfig.maxRetries + 1,
        lastError,
        canRetry: false,
      });

      // Log the final failure
      errorHandler(
        lastError!,
        {
          component: 'RetryHook',
          operation: 'async function execution',
          metadata: {
            maxRetries: finalConfig.maxRetries,
            finalAttempt: finalConfig.maxRetries + 1,
          },
        },
        'medium',
      );

      throw lastError!;
    },
    [asyncFn, finalConfig],
  );

  const reset = useCallback(() => {
    setState({
      isRetrying: false,
      currentAttempt: 0,
      lastError: null,
      canRetry: true,
    });
  }, []);

  return {
    execute: executeWithRetry,
    state,
    reset,
  };
}

/**
 * Pre-built retry condition predicates for common use cases.
 * Pass these as the `retryCondition` option to `useRetry`.
 */
export const retryConditions = {
  // Retry network errors but not validation errors
  networkOnly: (error: unknown) => {
    const err = error as Record<string, unknown> | null;
    return (
      err?.name === 'NetworkError' ||
      err?.code === 'NETWORK_ERROR' ||
      (typeof err?.message === 'string' &&
        (err.message.includes('network') || err.message.includes('fetch')))
    );
  },

  // Retry 5xx server errors but not 4xx client errors
  serverErrorsOnly: (error: unknown) => {
    const err = error as Record<string, unknown> | null;
    const response = err?.response as Record<string, unknown> | null;
    const status = (err?.status as number) || (response?.status as number);
    return status >= 500 && status < 600;
  },

  // Retry everything except auth errors
  nonAuthErrors: (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      !message.includes('auth') &&
      !message.includes('unauthorized') &&
      !message.includes('forbidden')
    );
  },

  // Exponential backoff with jitter
  withJitter: (_error: unknown, attemptNumber: number) => {
    // Add randomness to prevent thundering herd
    const jitter = Math.random() * 0.1; // 10% jitter
    const shouldRetry = Math.random() > jitter;
    return shouldRetry && attemptNumber < 5;
  },
};

/**
 * Specialized retry hook that only retries on network-related errors.
 *
 * @param networkFn - The async function to retry on network failures
 * @param config - Optional retry configuration (excluding retryCondition)
 * @returns Same return shape as `useRetry`
 */
export function useNetworkRetry<T extends unknown[], R>(
  networkFn: (...args: T) => Promise<R>,
  config?: Omit<RetryConfig, 'retryCondition'>,
) {
  return useRetry(networkFn, {
    ...config,
    retryCondition: retryConditions.networkOnly,
  });
}

/**
 * Specialized retry hook that retries all errors except authentication errors, with a maximum of 2 retries.
 *
 * @param authFn - The async function to retry on non-auth failures
 * @param config - Optional retry configuration (excluding retryCondition)
 * @returns Same return shape as `useRetry`
 */
export function useAuthRetry<T extends unknown[], R>(
  authFn: (...args: T) => Promise<R>,
  config?: Omit<RetryConfig, 'retryCondition'>,
) {
  return useRetry(authFn, {
    ...config,
    retryCondition: retryConditions.nonAuthErrors,
    maxRetries: 2, // Fewer retries for auth operations
  });
}
