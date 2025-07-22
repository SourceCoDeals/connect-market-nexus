/**
 * Enhanced Real-time Manager (Phase 4)
 * 
 * Prevents real-time interference with loading states and implements smart cache invalidation.
 * Uses debouncing and loading state awareness to prevent query flooding.
 */

import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type InvalidationCallback = () => void;

interface RealtimeSubscription {
  channel: any;
  queryKeys: string[];
  isConnected: boolean;
}

class EnhancedRealtimeManager {
  private queryClient: QueryClient | null = null;
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private pendingInvalidations: Set<string> = new Set();
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private loadingStates: Map<string, boolean> = new Map();

  // Configuration
  private readonly DEBOUNCE_DELAY = 300; // ms
  private readonly MAX_BATCH_SIZE = 5;

  initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
    console.log('🚀 EnhancedRealtimeManager initialized');
  }

  /**
   * Set loading state for a query key group
   */
  setLoadingState(queryKeyGroup: string, isLoading: boolean) {
    this.loadingStates.set(queryKeyGroup, isLoading);
    
    // If loading finished, process any pending invalidations
    if (!isLoading && this.pendingInvalidations.has(queryKeyGroup)) {
      this.processPendingInvalidations(queryKeyGroup);
    }
  }

  /**
   * Smart invalidation that respects loading states
   */
  invalidateQueries(queryKeys: string[], source: string = 'realtime') {
    if (!this.queryClient) return;

    const safeInvalidations: string[] = [];
    const deferredInvalidations: string[] = [];

    for (const queryKey of queryKeys) {
      const keyGroup = this.extractQueryKeyGroup(queryKey);
      
      if (this.loadingStates.get(keyGroup)) {
        // Defer if currently loading
        deferredInvalidations.push(queryKey);
        this.pendingInvalidations.add(keyGroup);
      } else {
        safeInvalidations.push(queryKey);
      }
    }

    // Process safe invalidations immediately (with debouncing)
    if (safeInvalidations.length > 0) {
      this.debouncedInvalidate(safeInvalidations, source);
    }

    // Log deferred invalidations
    if (deferredInvalidations.length > 0) {
      console.log(`⏳ Deferred ${deferredInvalidations.length} invalidations due to loading states`);
    }
  }

  /**
   * Create enhanced real-time subscription
   */
  createSubscription(
    subscriptionId: string,
    channelName: string,
    tableConfig: Array<{
      table: string;
      events: string[];
      queryKeys: string[];
      onEvent?: (payload: any) => void;
    }>
  ): () => void {
    if (this.subscriptions.has(subscriptionId)) {
      console.warn(`⚠️ Subscription ${subscriptionId} already exists`);
      return () => {};
    }

    console.log(`🔴 Creating enhanced subscription: ${subscriptionId}`);

    const allQueryKeys = tableConfig.flatMap(config => config.queryKeys);
    const channel = supabase.channel(channelName);

    // Set up table listeners
    tableConfig.forEach(config => {
      config.events.forEach(event => {
        channel.on(
          'postgres_changes',
          {
            event: event as any,
            schema: 'public',
            table: config.table
          },
          (payload) => {
            console.log(`📡 ${event} on ${config.table}:`, payload);
            
            // Execute custom callback if provided
            if (config.onEvent) {
              try {
                config.onEvent(payload);
              } catch (error) {
                console.error(`❌ Error in custom event handler:`, error);
              }
            }

            // Smart invalidation
            this.invalidateQueries(config.queryKeys, subscriptionId);
          }
        );
      });
    });

    // Subscribe and track connection status
    const subscription: RealtimeSubscription = {
      channel,
      queryKeys: allQueryKeys,
      isConnected: false
    };

    channel.subscribe((status) => {
      console.log(`📡 ${subscriptionId} status:`, status);
      subscription.isConnected = status === 'SUBSCRIBED';
    });

    this.subscriptions.set(subscriptionId, subscription);

    // Return cleanup function
    return () => {
      console.log(`🔌 Cleaning up subscription: ${subscriptionId}`);
      
      // Clear any pending timeouts for this subscription
      const timeoutKey = `${subscriptionId}-debounce`;
      if (this.debounceTimeouts.has(timeoutKey)) {
        clearTimeout(this.debounceTimeouts.get(timeoutKey)!);
        this.debounceTimeouts.delete(timeoutKey);
      }

      // Remove subscription
      supabase.removeChannel(channel);
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Get connection status for a subscription
   */
  getConnectionStatus(subscriptionId: string): boolean {
    return this.subscriptions.get(subscriptionId)?.isConnected || false;
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses() {
    const statuses: Record<string, boolean> = {};
    this.subscriptions.forEach((subscription, id) => {
      statuses[id] = subscription.isConnected;
    });
    return statuses;
  }

  private debouncedInvalidate(queryKeys: string[], source: string) {
    if (!this.queryClient) return;

    const timeoutKey = `${source}-debounce`;

    // Clear existing timeout
    if (this.debounceTimeouts.has(timeoutKey)) {
      clearTimeout(this.debounceTimeouts.get(timeoutKey)!);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      if (!this.queryClient) return;

      // Batch process invalidations
      const uniqueKeys = [...new Set(queryKeys)];
      const batches = this.createBatches(uniqueKeys, this.MAX_BATCH_SIZE);

      batches.forEach((batch, index) => {
        setTimeout(() => {
          batch.forEach(queryKey => {
            this.queryClient!.invalidateQueries({ queryKey: [queryKey] });
          });
          
          console.log(`✅ Invalidated batch ${index + 1}/${batches.length}: ${batch.join(', ')}`);
        }, index * 50); // 50ms stagger between batches
      });

      this.debounceTimeouts.delete(timeoutKey);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimeouts.set(timeoutKey, timeout);
  }

  private processPendingInvalidations(queryKeyGroup: string) {
    if (!this.queryClient) return;

    // Find all subscriptions that might have pending invalidations for this group
    const relevantKeys: string[] = [];
    
    this.subscriptions.forEach((subscription) => {
      subscription.queryKeys.forEach(key => {
        if (this.extractQueryKeyGroup(key) === queryKeyGroup) {
          relevantKeys.push(key);
        }
      });
    });

    if (relevantKeys.length > 0) {
      console.log(`🔄 Processing ${relevantKeys.length} pending invalidations for ${queryKeyGroup}`);
      this.debouncedInvalidate(relevantKeys, 'pending');
    }

    this.pendingInvalidations.delete(queryKeyGroup);
  }

  private extractQueryKeyGroup(queryKey: string): string {
    // Extract base query key group (e.g., 'admin-users' from 'admin-users-detailed')
    return queryKey.split('-')[0] || queryKey;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Clean up all resources
   */
  destroy() {
    console.log('🧹 Destroying EnhancedRealtimeManager');
    
    // Clear all timeouts
    this.debounceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.debounceTimeouts.clear();

    // Clean up all subscriptions
    this.subscriptions.forEach((subscription, id) => {
      supabase.removeChannel(subscription.channel);
    });
    this.subscriptions.clear();

    // Clear state
    this.loadingStates.clear();
    this.pendingInvalidations.clear();
    this.queryClient = null;
  }
}

// Create singleton instance
export const enhancedRealtimeManager = new EnhancedRealtimeManager();