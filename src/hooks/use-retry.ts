import { useState, useCallback } from 'react';
import { errorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

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

// Common retry conditions
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

// Specialized retry hooks for common use cases
export function useNetworkRetry<T extends unknown[], R>(
  networkFn: (...args: T) => Promise<R>,
  config?: Omit<RetryConfig, 'retryCondition'>,
) {
  return useRetry(networkFn, {
    ...config,
    retryCondition: retryConditions.networkOnly,
  });
}

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
