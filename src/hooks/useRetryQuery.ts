/**
 * `useRetryQuery` — a thin wrapper around React Query's `useQuery` that
 * applies resilient defaults (retry count, exponential backoff, sensible
 * stale/cache times) and integrates with the application's structured error
 * handling.
 */

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
  type QueryKey,
} from '@tanstack/react-query';
import { AppError, formatErrorMessage, isAuthError } from '@/lib/error-boundary';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RetryQueryOptions<
  TData = unknown,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<UseQueryOptions<TData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'> {
  /** Query key (passed through to React Query). */
  queryKey: TQueryKey;
  /** Async fetcher function. */
  queryFn: () => Promise<TData>;
  /** Maximum retry attempts (default: 3). */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000). */
  retryDelay?: number;
  /** Backoff factor (default: 2). */
  backoffFactor?: number;
  /** Time in ms before data is considered stale (default: 5 min). */
  staleTimeMs?: number;
  /** Time in ms to keep unused data in cache (default: 10 min). */
  gcTimeMs?: number;
  /** Human-readable label for logging (defaults to stringified queryKey). */
  operationName?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRetryQuery<
  TData = unknown,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: RetryQueryOptions<TData, TError, TQueryKey>,
): UseQueryResult<TData, TError> {
  const {
    queryKey,
    queryFn,
    maxRetries = 3,
    retryDelay = 1_000,
    backoffFactor = 2,
    staleTimeMs = 5 * 60 * 1_000, // 5 minutes
    gcTimeMs = 10 * 60 * 1_000, // 10 minutes
    operationName,
    ...rest
  } = options;

  const label = operationName ?? String(queryKey);

  return useQuery<TData, TError, TData, TQueryKey>({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        // Wrap in AppError for consistent handling
        const appError = AppError.from(error as Error);
        logger.warn(
          `Query "${label}" failed: ${appError.message}`,
          'useRetryQuery',
          { code: appError.code },
        );
        throw error; // re-throw original so React Query can manage retries
      }
    },

    // Retry configuration
    retry: (failureCount, error) => {
      // Never retry auth errors — the user needs to re-authenticate
      if (isAuthError(error)) {
        logger.info(
          `Query "${label}" hit an auth error — skipping retry`,
          'useRetryQuery',
        );
        return false;
      }
      const shouldRetry = failureCount < maxRetries;
      if (!shouldRetry) {
        logger.error(
          `Query "${label}" exhausted all ${maxRetries} retries`,
          'useRetryQuery',
        );
      }
      return shouldRetry;
    },

    retryDelay: (attemptIndex) => {
      const delay = Math.min(
        retryDelay * Math.pow(backoffFactor, attemptIndex),
        30_000,
      );
      // Add jitter (0-20 %)
      return delay + delay * Math.random() * 0.2;
    },

    // Cache / freshness
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,

    // Spread caller overrides last so they win
    ...rest,

    // Surface-level meta callback for logging on settled errors — note: this
    // doesn't replace React Query's built-in onError (which was removed in
    // v5). Instead we rely on the queryFn wrapper above and the retry
    // callback for reporting.
    meta: {
      ...(rest.meta ?? {}),
      errorMessage: `Failed to fetch: ${label}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Pre-configured retry query for network-heavy fetches (longer stale time,
 * more retries).
 */
export function useResilientQuery<
  TData = unknown,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: RetryQueryOptions<TData, TError, TQueryKey>,
): UseQueryResult<TData, TError> {
  return useRetryQuery<TData, TError, TQueryKey>({
    maxRetries: 5,
    retryDelay: 2_000,
    staleTimeMs: 10 * 60 * 1_000,
    gcTimeMs: 30 * 60 * 1_000,
    ...options,
  });
}

/**
 * Given a React Query error, produce a user-facing message.
 * Useful in component render logic:
 *
 * ```tsx
 * const { error } = useRetryQuery({ ... });
 * if (error) return <p>{getQueryErrorMessage(error)}</p>;
 * ```
 */
export function getQueryErrorMessage(error: unknown): string {
  return formatErrorMessage(error);
}
