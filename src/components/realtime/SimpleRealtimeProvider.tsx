
import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SimpleRealtimeContextType {
  isConnected: boolean;
}

const SimpleRealtimeContext = createContext<SimpleRealtimeContextType>({
  isConnected: false,
});

export const useSimpleRealtime = () => useContext(SimpleRealtimeContext);

interface SimpleRealtimeProviderProps {
  children: ReactNode;
}

export function SimpleRealtimeProvider({ children }: SimpleRealtimeProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    console.log('🔴 Setting up simple realtime subscriptions');

    // Simple listings subscription
    const listingsChannel = supabase
      .channel('simple-listings-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'listings'
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['listings'] });
      })
      .subscribe();

    // Simple connection requests subscription
    const connectionsChannel = supabase
      .channel('simple-connections-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connection_requests'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
        queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'connection_requests'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
        queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
        queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        
        // Simple status notifications
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
      })
      .subscribe();

    // Simple admin subscription (if admin)
    let adminChannel: any = null;
    if (user.is_admin) {
      adminChannel = supabase
        .channel('simple-admin-updates')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          toast({
            title: '👤 New User Registration',
            description: 'A new user has registered',
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        })
        .subscribe();
    }

    return () => {
      console.log('🔌 Cleaning up simple realtime subscriptions');
      supabase.removeChannel(listingsChannel);
      supabase.removeChannel(connectionsChannel);
      if (adminChannel) {
        supabase.removeChannel(adminChannel);
      }
    };
  }, [user?.id, user?.is_admin, queryClient]);

  return (
    <SimpleRealtimeContext.Provider value={{ isConnected: true }}>
      {children}
    </SimpleRealtimeContext.Provider>
  );
}
