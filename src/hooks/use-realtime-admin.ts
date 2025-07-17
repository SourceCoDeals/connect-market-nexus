
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useRealtimeAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const isAdmin = user?.is_admin || false;

  useEffect(() => {
    // Only setup admin real-time for admin users
    if (!isAdmin) return;

    console.log('🔴 Setting up real-time admin notifications');
    
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('👤 New user registered:', payload.new);
          toast({
            title: '👤 New User Registration',
            description: `${payload.new.first_name} ${payload.new.last_name} has registered`,
          });
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_requests'
        },
        (payload) => {
          console.log('🔗 New connection request for admin:', payload.new);
          toast({
            title: '🔗 New Connection Request',
            description: 'A new connection request requires review',
          });
          queryClient.invalidateQueries({ queryKey: ['admin-connection-requests'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listings'
        },
        (payload) => {
          console.log('📋 New listing created:', payload.new);
          toast({
            title: '📋 New Listing Created',
            description: `"${payload.new.title}" has been added`,
          });
          queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Admin notifications realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up admin notifications realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [isAdmin, queryClient]);

  return { isConnected };
}
