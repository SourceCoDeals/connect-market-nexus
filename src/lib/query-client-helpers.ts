import { QueryClient } from '@tanstack/react-query';
import { INVALIDATION_PATTERNS } from './query-keys';

// Enhanced query client helpers with safe invalidation
export const safeInvalidateQueries = async (
  queryClient: QueryClient,
  patterns: Array<{ queryKey: readonly unknown[] }>
) => {
  try {
    await Promise.all(
      patterns.map(pattern => 
        queryClient.invalidateQueries({ queryKey: pattern.queryKey })
      )
    );
  } catch (error) {
    console.error('Error invalidating queries:', error);
    // Don't throw - invalidation errors shouldn't break user operations
  }
};

// Centralized invalidation helpers
export const invalidateSavedListings = (queryClient: QueryClient) => {
  return safeInvalidateQueries(queryClient, INVALIDATION_PATTERNS.savedListings());
};

export const invalidateConnectionRequests = (queryClient: QueryClient) => {
  return safeInvalidateQueries(queryClient, INVALIDATION_PATTERNS.connectionRequests());
};

export const invalidateUserProfile = (queryClient: QueryClient, userId?: string) => {
  return safeInvalidateQueries(queryClient, INVALIDATION_PATTERNS.userProfile(userId));
};