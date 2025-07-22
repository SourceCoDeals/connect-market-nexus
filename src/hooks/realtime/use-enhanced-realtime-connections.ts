/**
 * Enhanced Real-time Connections Hook (Phase 4)
 * 
 * Uses the enhanced real-time manager for smart cache invalidation and loading state awareness.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enhancedRealtimeManager } from '@/lib/enhanced-realtime-manager';
import { toast } from '@/hooks/use-toast';

export function useEnhancedRealtimeConnections() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize manager if needed
    enhancedRealtimeManager.initialize(queryClient);

    // Track loading states for connection queries
    const unsubscribeLoading = () => {
      // Monitor query states and inform the realtime manager
      const checkLoadingStates = () => {
        const connectionQueries = ['connection-status', 'user-connection-requests', 'admin-connection-requests'];
        
        connectionQueries.forEach(queryKey => {
          const query = queryClient.getQueryState([queryKey]);
          const isLoading = query?.fetchStatus === 'fetching';
          enhancedRealtimeManager.setLoadingState(queryKey, isLoading);
        });
      };

      const interval = setInterval(checkLoadingStates, 200);
      return () => clearInterval(interval);
    };

    const cleanupLoadingTracking = unsubscribeLoading();

    // Create enhanced subscription
    const cleanupSubscription = enhancedRealtimeManager.createSubscription(
      'enhanced-connections',
      'enhanced-connection-requests-realtime',
      [
        {
          table: 'connection_requests',
          events: ['INSERT'],
          queryKeys: ['connection-status', 'user-connection-requests', 'admin-connection-requests'],
          onEvent: (payload) => {
            console.log('🆕 Enhanced: New connection request:', payload.new);
          }
        },
        {
          table: 'connection_requests',
          events: ['UPDATE'],
          queryKeys: ['connection-status', 'user-connection-requests', 'admin-connection-requests'],
          onEvent: (payload) => {
            console.log('📝 Enhanced: Connection request updated:', payload.new);
            
            // Show enhanced notifications
            if (payload.old?.status !== payload.new?.status) {
              const newStatus = payload.new.status;
              if (newStatus === 'approved') {
                toast({
                  title: 'Connection Approved! ✅',
                  description: 'Your connection request has been approved.',
                });
              } else if (newStatus === 'rejected') {
                toast({
                  title: 'Connection Update',
                  description: 'Your connection request status has been updated.',
                  variant: 'destructive',
                });
              }
            }
          }
        }
      ]
    );

    // Monitor connection status
    const checkConnection = () => {
      const connected = enhancedRealtimeManager.getConnectionStatus('enhanced-connections');
      setIsConnected(connected);
    };

    const connectionInterval = setInterval(checkConnection, 1000);

    return () => {
      console.log('🔌 Cleaning up enhanced connections realtime');
      cleanupSubscription();
      cleanupLoadingTracking();
      clearInterval(connectionInterval);
      setIsConnected(false);
    };
  }, [queryClient]);

  return { 
    isConnected,
    // Enhanced features
    getConnectionStatus: () => enhancedRealtimeManager.getConnectionStatus('enhanced-connections'),
    getAllStatuses: () => enhancedRealtimeManager.getAllConnectionStatuses()
  };
}