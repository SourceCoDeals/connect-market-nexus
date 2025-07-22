
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export function useUserSessionRefresh() {
  const { user, refreshUserProfile } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🔴 Setting up user session refresh subscription for:', user.email);
    
    const channel = supabase
      .channel(`user-session-refresh-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        async (payload) => {
          console.log('📝 User profile updated in real-time:', payload.new);
          
          // Refresh the user profile immediately
          try {
            await refreshUserProfile();
            console.log('✅ User profile refreshed after real-time update');
          } catch (error) {
            console.error('❌ Error refreshing user profile:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 User session refresh status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up user session refresh subscription');
      supabase.removeChannel(channel);
    };
  }, [user, refreshUserProfile]);
}
