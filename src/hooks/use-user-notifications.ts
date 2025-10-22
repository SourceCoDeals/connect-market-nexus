import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface UserNotification {
  id: string;
  user_id: string;
  connection_request_id?: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function useUserNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserNotification[];
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  // Real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('user-notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [queryClient]);

  const unreadCount = (query.data || []).filter(n => !n.is_read).length;
  
  // Get unread count by connection request
  const unreadByRequest = (query.data || [])
    .filter(n => !n.is_read && n.connection_request_id)
    .reduce((acc, n) => {
      const requestId = n.connection_request_id!;
      acc[requestId] = (acc[requestId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return {
    notifications: query.data || [],
    unreadCount,
    unreadByRequest,
    isLoading: query.isLoading,
  };
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string | string[]) => {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      
      const { error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });
}

export function useMarkRequestNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionRequestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('connection_request_id', connectionRequestId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });
}
