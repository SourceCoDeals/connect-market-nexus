
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers } from "./use-admin-users";
import { useAuth } from "@/context/AuthContext";

export function useRealtimeAdminUsers() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const adminUsers = useAdminUsers();

  useEffect(() => {
    if (!isAdmin || !user) return;

    console.log('🔴 Setting up real-time admin users subscription');
    
    const channel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('📝 Profile updated in real-time:', payload.new);
          
          // Immediately invalidate and refetch admin users data
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          queryClient.refetchQueries({ queryKey: ['admin-users'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('🆕 New profile created in real-time:', payload.new);
          
          // Immediately invalidate and refetch admin users data
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          queryClient.refetchQueries({ queryKey: ['admin-users'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Admin users realtime status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up admin users realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient, isAdmin, user]);

  return adminUsers;
}
