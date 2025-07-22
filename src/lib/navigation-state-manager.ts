/**
 * Navigation State Manager (Phase 5)
 * 
 * Prevents navigation state conflicts and ensures queries complete before navigation.
 * Provides loading state persistence across route changes.
 */

import { QueryClient } from '@tanstack/react-query';

type NavigationGuard = (to: string, from: string) => boolean | Promise<boolean>;
type LoadingStateListener = (isLoading: boolean) => void;

interface NavigationState {
  currentRoute: string;
  isNavigating: boolean;
  hasActiveQueries: boolean;
  persistentLoadingStates: Map<string, boolean>;
}

class NavigationStateManager {
  private queryClient: QueryClient | null = null;
  private navigationState: NavigationState = {
    currentRoute: '/',
    isNavigating: false,
    hasActiveQueries: false,
    persistentLoadingStates: new Map()
  };
  
  private navigationGuards: Set<NavigationGuard> = new Set();
  private loadingListeners: Set<LoadingStateListener> = new Set();
  private queryCheckInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly QUERY_SETTLE_TIMEOUT = 2000; // ms
  private readonly QUERY_CHECK_INTERVAL = 100; // ms

  initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.startQueryMonitoring();
    console.log('🚀 NavigationStateManager initialized');
  }

  /**
   * Get current navigation state
   */
  getState(): NavigationState {
    return { ...this.navigationState };
  }

  /**
   * Set current route and handle navigation logic
   */
  async setCurrentRoute(newRoute: string): Promise<boolean> {
    const oldRoute = this.navigationState.currentRoute;
    
    if (oldRoute === newRoute) return true;

    console.log(`🧭 Navigation attempt: ${oldRoute} → ${newRoute}`);

    // Check navigation guards
    const canNavigate = await this.checkNavigationGuards(newRoute, oldRoute);
    if (!canNavigate) {
      console.log(`🚫 Navigation blocked by guard: ${oldRoute} → ${newRoute}`);
      return false;
    }

    // Wait for active queries if needed
    const queriesSettled = await this.waitForQueries();
    if (!queriesSettled) {
      console.log(`⏳ Navigation delayed due to active queries: ${oldRoute} → ${newRoute}`);
      return false;
    }

    // Update navigation state
    this.navigationState.isNavigating = true;
    this.navigationState.currentRoute = newRoute;

    // Preserve loading states across navigation
    this.preserveLoadingStates(oldRoute, newRoute);

    console.log(`✅ Navigation completed: ${oldRoute} → ${newRoute}`);
    this.navigationState.isNavigating = false;

    return true;
  }

  /**
   * Add navigation guard
   */
  addNavigationGuard(guard: NavigationGuard): () => void {
    this.navigationGuards.add(guard);
    
    return () => {
      this.navigationGuards.delete(guard);
    };
  }

  /**
   * Set loading state for a specific context
   */
  setLoadingState(context: string, isLoading: boolean) {
    const changed = this.navigationState.persistentLoadingStates.get(context) !== isLoading;
    
    this.navigationState.persistentLoadingStates.set(context, isLoading);
    
    if (changed) {
      this.notifyLoadingListeners();
    }
  }

  /**
   * Get loading state for a context
   */
  getLoadingState(context: string): boolean {
    return this.navigationState.persistentLoadingStates.get(context) || false;
  }

  /**
   * Get overall loading state
   */
  getOverallLoadingState(): boolean {
    return Array.from(this.navigationState.persistentLoadingStates.values()).some(Boolean) ||
           this.navigationState.hasActiveQueries ||
           this.navigationState.isNavigating;
  }

  /**
   * Subscribe to loading state changes
   */
  subscribeToLoadingState(listener: LoadingStateListener): () => void {
    this.loadingListeners.add(listener);
    
    // Immediately notify with current state
    listener(this.getOverallLoadingState());
    
    return () => {
      this.loadingListeners.delete(listener);
    };
  }

  /**
   * Force wait for all queries to settle
   */
  async waitForQueriesSettled(timeout: number = this.QUERY_SETTLE_TIMEOUT): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkQueries = () => {
        if (!this.queryClient) {
          resolve(true);
          return;
        }

        const isFetching = this.queryClient.isFetching() > 0;
        const isMutating = this.queryClient.isMutating() > 0;
        const hasActiveQueries = isFetching || isMutating;
        
        if (!hasActiveQueries) {
          console.log('✅ All queries settled');
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          console.log(`⏰ Query settle timeout reached (${timeout}ms)`);
          resolve(false);
          return;
        }

        setTimeout(checkQueries, this.QUERY_CHECK_INTERVAL);
      };

      checkQueries();
    });
  }

  /**
   * Clear loading state for a context
   */
  clearLoadingState(context: string) {
    if (this.navigationState.persistentLoadingStates.has(context)) {
      this.navigationState.persistentLoadingStates.delete(context);
      this.notifyLoadingListeners();
    }
  }

  /**
   * Clear all loading states
   */
  clearAllLoadingStates() {
    this.navigationState.persistentLoadingStates.clear();
    this.notifyLoadingListeners();
  }

  private async checkNavigationGuards(to: string, from: string): Promise<boolean> {
    for (const guard of this.navigationGuards) {
      try {
        const result = await guard(to, from);
        if (!result) return false;
      } catch (error) {
        console.error('❌ Navigation guard error:', error);
        return false;
      }
    }
    return true;
  }

  private async waitForQueries(): Promise<boolean> {
    if (!this.queryClient || !this.navigationState.hasActiveQueries) {
      return true;
    }

    console.log('⏳ Waiting for queries to settle before navigation...');
    return await this.waitForQueriesSettled();
  }

  private preserveLoadingStates(fromRoute: string, toRoute: string) {
    // Preserve certain loading states when navigating between related routes
    const shouldPreserve = this.shouldPreserveLoadingState(fromRoute, toRoute);
    
    if (!shouldPreserve) {
      // Clear non-persistent states on navigation
      const keysToRemove: string[] = [];
      this.navigationState.persistentLoadingStates.forEach((_, key) => {
        if (key.includes('temporary') || key.includes('page-specific')) {
          keysToRemove.push(key);
        }
      });
      
      keysToRemove.forEach(key => {
        this.navigationState.persistentLoadingStates.delete(key);
      });
    }

    console.log(`📦 Loading states preserved: ${shouldPreserve}`);
  }

  private shouldPreserveLoadingState(fromRoute: string, toRoute: string): boolean {
    // Preserve loading states when navigating within the same section
    const fromSection = this.getRouteSection(fromRoute);
    const toSection = this.getRouteSection(toRoute);
    
    return fromSection === toSection;
  }

  private getRouteSection(route: string): string {
    const segments = route.split('/').filter(Boolean);
    return segments[0] || 'root';
  }

  private startQueryMonitoring() {
    if (this.queryCheckInterval) return;

    this.queryCheckInterval = setInterval(() => {
      if (!this.queryClient) return;

      const isFetching = this.queryClient.isFetching() > 0;
      const isMutating = this.queryClient.isMutating() > 0;
      const hasActiveQueries = isFetching || isMutating;
      
      if (this.navigationState.hasActiveQueries !== hasActiveQueries) {
        this.navigationState.hasActiveQueries = hasActiveQueries;
        this.notifyLoadingListeners();
      }
    }, this.QUERY_CHECK_INTERVAL);
  }

  private notifyLoadingListeners() {
    const overallLoading = this.getOverallLoadingState();
    this.loadingListeners.forEach(listener => {
      try {
        listener(overallLoading);
      } catch (error) {
        console.error('❌ Loading state listener error:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    console.log('🧹 Destroying NavigationStateManager');
    
    if (this.queryCheckInterval) {
      clearInterval(this.queryCheckInterval);
      this.queryCheckInterval = null;
    }

    this.navigationGuards.clear();
    this.loadingListeners.clear();
    this.navigationState.persistentLoadingStates.clear();
    this.queryClient = null;
  }
}

// Create singleton instance
export const navigationStateManager = new NavigationStateManager();