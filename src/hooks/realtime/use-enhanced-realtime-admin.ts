/**
 * Enhanced Real-time Admin Hook (Phase 4)
 * 
 * Uses the enhanced real-time manager for smart cache invalidation and loading state awareness.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { enhancedRealtimeManager } from '@/lib/enhanced-realtime-manager';
import { toast } from '@/hooks/use-toast';

export function useEnhancedRealtimeAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    // Only setup for admin users
    if (!isAdmin) {
      setIsConnected(false);
      return;
    }

    // Initialize manager if needed
    enhancedRealtimeManager.initialize(queryClient);

    // Track loading states for admin queries
    const unsubscribeLoading = () => {
      const checkLoadingStates = () => {
        const adminQueries = ['admin-users', 'admin-connection-requests', 'admin-listings'];
        
        adminQueries.forEach(queryKey => {
          const query = queryClient.getQueryState([queryKey]);
          const isLoading = query?.fetchStatus === 'fetching';
          enhancedRealtimeManager.setLoadingState(queryKey, isLoading);
        });
      };

      const interval = setInterval(checkLoadingStates, 200);
      return () => clearInterval(interval);
    };

    const cleanupLoadingTracking = unsubscribeLoading();

    // Create enhanced admin subscription
    const cleanupSubscription = enhancedRealtimeManager.createSubscription(
      'enhanced-admin',
      'enhanced-admin-notifications-realtime',
      [
        {
          table: 'profiles',
          events: ['INSERT'],
          queryKeys: ['admin-users'],
          onEvent: (payload) => {
            console.log('👤 Enhanced: New user registered:', payload.new);
            toast({
              title: '👤 New User Registration',
              description: `${payload.new.first_name} ${payload.new.last_name} has registered`,
            });
          }
        },
        {
          table: 'profiles',
          events: ['UPDATE'],
          queryKeys: ['admin-users'],
          onEvent: (payload) => {
            console.log('🔄 Enhanced: User profile updated:', payload.new);
            
            // Enhanced status change notifications
            if (payload.old?.approval_status !== payload.new?.approval_status) {
              const status = payload.new.approval_status;
              const userName = `${payload.new.first_name} ${payload.new.last_name}`;
              toast({
                title: `👤 User ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'}`,
                description: `${userName} status changed to ${status}`,
              });
            }
            
            // Admin privilege changes
            if (payload.old?.is_admin !== payload.new?.is_admin) {
              const userName = `${payload.new.first_name} ${payload.new.last_name}`;
              toast({
                title: payload.new.is_admin ? '👑 User Promoted to Admin' : '👤 Admin Privileges Revoked',
                description: `${userName} ${payload.new.is_admin ? 'is now an admin' : 'is no longer an admin'}`,
              });
            }
          }
        },
        {
          table: 'profiles',
          events: ['DELETE'],
          queryKeys: ['admin-users'],
          onEvent: (payload) => {
            console.log('🗑️ Enhanced: User profile deleted:', payload.old);
            const userName = `${payload.old.first_name} ${payload.old.last_name}`;
            toast({
              title: '🗑️ User Deleted',
              description: `${userName} has been removed from the system`,
            });
          }
        },
        {
          table: 'connection_requests',
          events: ['INSERT'],
          queryKeys: ['admin-connection-requests'],
          onEvent: (payload) => {
            console.log('🔗 Enhanced: New connection request for admin:', payload.new);
            toast({
              title: '🔗 New Connection Request',
              description: 'A new connection request requires review',
            });
          }
        },
        {
          table: 'listings',
          events: ['INSERT'],
          queryKeys: ['admin-listings'],
          onEvent: (payload) => {
            console.log('📋 Enhanced: New listing created:', payload.new);
            toast({
              title: '📋 New Listing Created',
              description: `"${payload.new.title}" has been added`,
            });
          }
        }
      ]
    );

    // Monitor connection status
    const checkConnection = () => {
      const connected = enhancedRealtimeManager.getConnectionStatus('enhanced-admin');
      setIsConnected(connected);
    };

    const connectionInterval = setInterval(checkConnection, 1000);

    return () => {
      console.log('🔌 Cleaning up enhanced admin realtime');
      cleanupSubscription();
      cleanupLoadingTracking();
      clearInterval(connectionInterval);
      setIsConnected(false);
    };
  }, [isAdmin, queryClient]);

  return { 
    isConnected,
    // Enhanced features
    getConnectionStatus: () => enhancedRealtimeManager.getConnectionStatus('enhanced-admin'),
    getAllStatuses: () => enhancedRealtimeManager.getAllConnectionStatuses()
  };
}