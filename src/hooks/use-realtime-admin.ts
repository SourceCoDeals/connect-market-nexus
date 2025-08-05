
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
    if (!isAdmin) {
      setIsConnected(false);
      return;
    }

    // Setting up consolidated realtime admin notifications
    
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🔄 User profile updated:', payload.new);
          
          // Only show notifications and invalidate for significant changes
          const hasSignificantChange = 
            payload.old?.approval_status !== payload.new?.approval_status ||
            payload.old?.is_admin !== payload.new?.is_admin;
          
          if (!hasSignificantChange) {
            return; // Skip invalidation for minor profile updates
          }
          
          // Enhanced status change notifications (consolidated from enhanced hook)
          if (payload.old?.approval_status !== payload.new?.approval_status) {
            const status = payload.new.approval_status;
            const userName = `${payload.new.first_name} ${payload.new.last_name}`;
            toast({
              title: `👤 User ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'}`,
              description: `${userName} status changed to ${status}`,
            });
          }
          
          // Admin privilege changes (consolidated from enhanced hook)
          if (payload.old?.is_admin !== payload.new?.is_admin) {
            const userName = `${payload.new.first_name} ${payload.new.last_name}`;
            toast({
              title: payload.new.is_admin ? '👑 User Promoted to Admin' : '👤 Admin Privileges Revoked',
              description: `${userName} ${payload.new.is_admin ? 'is now an admin' : 'is no longer an admin'}`,
            });
          }
          
          // Use setTimeout to batch invalidations and prevent excessive re-renders
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🗑️ User profile deleted:', payload.old);
          const userName = `${payload.old.first_name} ${payload.old.last_name}`;
          toast({
            title: '🗑️ User Deleted',
            description: `${userName} has been removed from the system`,
          });
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Consolidated admin notifications realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('🔌 Cleaning up consolidated admin realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [isAdmin, queryClient]);

  return { isConnected };
}
