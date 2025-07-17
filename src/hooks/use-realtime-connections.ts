
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export function useRealtimeConnections() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('🔴 Setting up real-time connection requests subscription');
    
    const channel = supabase
      .channel('connection-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_requests'
        },
        (payload) => {
          console.log('🆕 New connection request:', payload.new);
          // Invalidate connection-related queries
          queryClient.invalidateQueries({ queryKey: ['connection-status'] });
          queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
          queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connection_requests'
        },
        (payload) => {
          console.log('📝 Connection request updated:', payload.new);
          
          // Show notification for status changes
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
          
          // Invalidate all connection-related queries
          queryClient.invalidateQueries({ queryKey: ['connection-status'] });
          queryClient.invalidateQueries({ queryKey: ['user-connection-requests'] });
          queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Connection requests realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up connection requests realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [queryClient]);

  return { isConnected };
}
