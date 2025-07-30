
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Listing } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeListings() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('🔴 Setting up real-time listings subscription');
    
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
          console.log('🆕 New listing inserted:', payload.new);
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
          console.log('📝 Listing updated:', payload.new);
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
          console.log('🗑️ Listing deleted:', payload.old);
          queryClient.invalidateQueries({ queryKey: ['listings'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Listings realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up listings realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [queryClient]);

  return { isConnected };
}
