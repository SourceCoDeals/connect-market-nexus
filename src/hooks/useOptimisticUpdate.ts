/**
 * `useOptimisticUpdate` — a hook that wraps `useMutation` from React Query
 * to perform optimistic UI updates with automatic rollback on failure and
 * user-facing toast notifications.
 *
 * Usage:
 * ```tsx
 * const { mutate } = useOptimisticUpdate<Deal[], Partial<Deal>>({
 *   queryKey: ['deals'],
 *   mutationFn: (vars) => api.updateDeal(vars),
 *   optimisticUpdate: (old, vars) =>
 *     old.map(d => d.id === vars.id ? { ...d, ...vars } : d),
 *   successMessage: 'Deal updated',
 * });
 * ```
 */

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatErrorMessage } from '@/lib/error-boundary';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseOptimisticUpdateOptions<TData, TVars> {
  /** The React Query cache key that holds the data to update optimistically. */
  queryKey: QueryKey;
  /** The actual async mutation (API call). */
  mutationFn: (variables: TVars) => Promise<TData>;
  /**
   * Pure function that returns the optimistically-updated cache value.
   * Receives the current cached value and the mutation variables.
   */
  optimisticUpdate: (currentData: TData | undefined, variables: TVars) => TData;
  /** Toast message shown on success (default: "Changes saved"). */
  successMessage?: string;
  /** Toast message shown on rollback (default: derived from error). */
  errorMessage?: string;
  /** Called after a successful mutation + settlement. */
  onSuccess?: (data: TData, variables: TVars) => void;
  /** Called when the mutation fails (after rollback). */
  onError?: (error: Error, variables: TVars) => void;
  /** Additional query keys to invalidate after success. */
  invalidateKeys?: QueryKey[];
  /** Human-readable label for logging. */
  operationName?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOptimisticUpdate<TData = unknown, TVars = void>(
  options: UseOptimisticUpdateOptions<TData, TVars>,
): UseMutationResult<TData, Error, TVars> {
  const queryClient = useQueryClient();

  const {
    queryKey,
    mutationFn,
    optimisticUpdate,
    successMessage = 'Changes saved',
    errorMessage,
    onSuccess,
    onError,
    invalidateKeys = [],
    operationName = 'mutation',
  } = options;

  return useMutation<TData, Error, TVars, { previousData: TData | undefined }>({
    mutationFn,

    // ---- Optimistic update ------------------------------------------------
    onMutate: async (variables: TVars) => {
      // Cancel in-flight queries so they don't overwrite our optimistic data
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the current value for rollback
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Write the optimistic value into the cache
      queryClient.setQueryData<TData>(queryKey, (old) =>
        optimisticUpdate(old, variables),
      );

      logger.debug(
        `Optimistic update applied for "${operationName}"`,
        'useOptimisticUpdate',
      );

      return { previousData };
    },

    // ---- Rollback on error ------------------------------------------------
    onError: (error: Error, variables: TVars, context) => {
      // Restore the snapshot
      if (context?.previousData !== undefined) {
        queryClient.setQueryData<TData>(queryKey, context.previousData);
        logger.warn(
          `Rolled back optimistic update for "${operationName}"`,
          'useOptimisticUpdate',
          { error: error.message },
        );
      }

      // Show toast
      const message = errorMessage ?? formatErrorMessage(error);
      toast.error(message);

      // Notify caller
      onError?.(error, variables);
    },

    // ---- Settlement -------------------------------------------------------
    onSuccess: (data: TData, variables: TVars) => {
      toast.success(successMessage);
      onSuccess?.(data, variables);
    },

    // Always refetch after error or success to make sure we're in sync with
    // the server.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });

      // Invalidate additional related keys
      for (const key of invalidateKeys) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export default useOptimisticUpdate;
