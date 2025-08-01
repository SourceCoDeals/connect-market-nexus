import { QueryClient } from '@tanstack/react-query';
import { User } from '@/types';

/**
 * Centralized cache manager for consistent user data updates
 * This ensures all user data updates happen in one place with consistent rollback
 */
export class CentralizedCacheManager {
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Update user data across all relevant query keys
   */
  updateUserData(userId: string, updates: Partial<User>) {
    const queryKeys = [
      ['admin-users'],
      ['connection-requests'],
      ['user-profile', userId]
    ];

    const previousData: Record<string, any> = {};

    // Store previous data for rollback
    queryKeys.forEach(key => {
      previousData[key.join('-')] = this.queryClient.getQueryData(key);
    });

    // Update admin users
    this.queryClient.setQueryData(['admin-users'], (old: User[] | undefined) => {
      if (!old) return old;
      return old.map(user => 
        user.id === userId 
          ? { ...user, ...updates }
          : user
      );
    });

    // Update connection requests
    this.queryClient.setQueryData(['connection-requests'], (old: any) => {
      if (!old) return old;
      return old.map((request: any) => 
        request.user?.id === userId 
          ? { 
              ...request, 
              user: { ...request.user, ...updates }
            }
          : request
      );
    });

    // Update user profile
    this.queryClient.setQueryData(['user-profile', userId], (old: User | undefined) => {
      if (!old) return old;
      return { ...old, ...updates };
    });

    return previousData;
  }

  /**
   * Rollback user data changes
   */
  rollbackUserData(previousData: Record<string, any>) {
    Object.entries(previousData).forEach(([keyString, data]) => {
      const key = keyString.split('-');
      this.queryClient.setQueryData(key, data);
    });
  }

  /**
   * Force refresh specific query keys (only on error)
   */
  forceRefresh(queryKeys: string[][]) {
    queryKeys.forEach(key => {
      this.queryClient.invalidateQueries({ queryKey: key });
    });
  }
}