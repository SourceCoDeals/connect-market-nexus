
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Listing } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeListings() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('marketplace-listings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listings'
        },
        (payload) => {
          // Invalidate listings query to refetch data
          queryClient.invalidateQueries({ queryKey: ['listings'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'listings'
        },
        (payload) => {
          // Invalidate both marketplace and single listing queries
          queryClient.invalidateQueries({ queryKey: ['listings'] });
          queryClient.invalidateQueries({ queryKey: ['listing', payload.new.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'listings'
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['listings'] });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [queryClient]);

  return { isConnected };
}
