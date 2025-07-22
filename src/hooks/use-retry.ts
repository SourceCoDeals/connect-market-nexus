import { useState, useCallback } from 'react';
import { errorHandler } from '@/lib/error-handler';

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any, attemptNumber: number) => boolean;
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

export function useRetry<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  config: RetryConfig = {}
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
      setState(prev => ({
        ...prev,
        isRetrying: true,
        currentAttempt: 0,
        lastError: null,
        canRetry: true,
      }));

      let lastError: Error;

      for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
          setState(prev => ({ ...prev, currentAttempt: attempt + 1 }));

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
          
          console.warn(`🔄 Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} failed:`, lastError.message);

          // Check if we should retry this error
          if (!finalConfig.retryCondition(lastError, attempt)) {
            console.log('🚫 Retry condition failed, stopping retries');
            break;
          }

          // If this wasn't the last attempt, wait before retrying
          if (attempt < finalConfig.maxRetries) {
            const delay = Math.min(
              finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt),
              finalConfig.maxDelay
            );
            
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
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
        'medium'
      );

      throw lastError!;
    },
    [asyncFn, finalConfig]
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
  networkOnly: (error: any) => {
    return error?.name === 'NetworkError' || 
           error?.code === 'NETWORK_ERROR' ||
           error?.message?.includes('network') ||
           error?.message?.includes('fetch');
  },

  // Retry 5xx server errors but not 4xx client errors
  serverErrorsOnly: (error: any) => {
    const status = error?.status || error?.response?.status;
    return status >= 500 && status < 600;
  },

  // Retry everything except auth errors
  nonAuthErrors: (error: any) => {
    return !error?.message?.toLowerCase().includes('auth') &&
           !error?.message?.toLowerCase().includes('unauthorized') &&
           !error?.message?.toLowerCase().includes('forbidden');
  },

  // Exponential backoff with jitter
  withJitter: (error: any, attemptNumber: number) => {
    // Add randomness to prevent thundering herd
    const jitter = Math.random() * 0.1; // 10% jitter
    const shouldRetry = Math.random() > jitter;
    return shouldRetry && attemptNumber < 5;
  },
};

// Specialized retry hooks for common use cases
export function useNetworkRetry<T extends any[], R>(
  networkFn: (...args: T) => Promise<R>,
  config?: Omit<RetryConfig, 'retryCondition'>
) {
  return useRetry(networkFn, {
    ...config,
    retryCondition: retryConditions.networkOnly,
  });
}

export function useAuthRetry<T extends any[], R>(
  authFn: (...args: T) => Promise<R>,
  config?: Omit<RetryConfig, 'retryCondition'>
) {
  return useRetry(authFn, {
    ...config,
    retryCondition: retryConditions.nonAuthErrors,
    maxRetries: 2, // Fewer retries for auth operations
  });
}