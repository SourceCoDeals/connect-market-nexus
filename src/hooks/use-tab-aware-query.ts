
/**
 * Tab Aware Query Hook (Phase 6)
 * 
 * Prevents infinite loading loops when switching tabs by managing query state intelligently.
 * Only refetches when truly necessary and tab has been visible for sufficient time.
 */

import { useQuery, QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { tabVisibilityManager } from '@/lib/tab-visibility-manager';

interface TabAwareQueryOptions<TData, TError> extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
  // Custom options for tab awareness
  refetchOnVisibilityChange?: boolean;
  minVisibleTimeBeforeRefetch?: number; // ms
  pauseWhenHidden?: boolean;
}

export function useTabAwareQuery<TData = unknown, TError = Error>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options: TabAwareQueryOptions<TData, TError> = {}
): UseQueryResult<TData, TError> {
  const [isTabVisible, setIsTabVisible] = useState(tabVisibilityManager.getVisibility());
  const [lastVisibilityChange, setLastVisibilityChange] = useState(Date.now());

  const {
    refetchOnVisibilityChange = false,
    minVisibleTimeBeforeRefetch = 1000,
    pauseWhenHidden = true,
    ...queryOptions
  } = options;

  // Track tab visibility
  useEffect(() => {
    const unsubscribe = tabVisibilityManager.subscribe((visible) => {
      setIsTabVisible(visible);
      setLastVisibilityChange(Date.now());
    });

    return unsubscribe;
  }, []);

  // Smart refetch logic
  const shouldRefetch = () => {
    if (!isTabVisible && pauseWhenHidden) {
      return false;
    }

    if (refetchOnVisibilityChange && isTabVisible) {
      const timeSinceVisible = Date.now() - lastVisibilityChange;
      return timeSinceVisible >= minVisibleTimeBeforeRefetch;
    }

    return true;
  };

  // Enhanced query options
  const enhancedOptions: UseQueryOptions<TData, TError> = {
    ...queryOptions,
    queryKey,
    queryFn,
    enabled: (queryOptions.enabled !== false) && shouldRefetch(),
    refetchOnWindowFocus: false, // We handle this manually
    refetchOnMount: shouldRefetch(),
    refetchOnReconnect: shouldRefetch(),
  };

  const queryResult = useQuery(enhancedOptions);

  // Handle manual refetch on visibility change
  useEffect(() => {
    if (refetchOnVisibilityChange && isTabVisible && queryResult.refetch) {
      const timeSinceVisible = Date.now() - lastVisibilityChange;
      
      if (timeSinceVisible >= minVisibleTimeBeforeRefetch && !queryResult.isFetching) {
        console.log(`🔄 Tab aware refetch for query:`, queryKey);
        
        // Small delay to avoid race conditions
        const timeoutId = setTimeout(() => {
          queryResult.refetch();
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [isTabVisible, lastVisibilityChange, refetchOnVisibilityChange, minVisibleTimeBeforeRefetch, queryResult.refetch, queryResult.isFetching]);

  return queryResult;
}

// Convenience hook for common marketplace queries
export function useTabAwareMarketplaceQuery<TData = unknown, TError = Error>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options: TabAwareQueryOptions<TData, TError> = {}
): UseQueryResult<TData, TError> {
  return useTabAwareQuery(queryKey, queryFn, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnVisibilityChange: false, // Don't refetch on tab switch for marketplace
    pauseWhenHidden: true,
    ...options,
  });
}
