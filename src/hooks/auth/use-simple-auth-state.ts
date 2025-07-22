
import { useState, useEffect, useCallback } from "react";
import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject } from "@/lib/auth-helpers";

export function useSimpleAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Simple cleanup function - no complex localStorage manipulation
  const clearAuthState = useCallback(async () => {
    console.log('🧹 Clearing auth state');
    setUser(null);
    localStorage.removeItem("user");
    setIsLoading(false);
    setAuthChecked(true);
  }, []);

  // Simple user data refresh
  const refreshUserData = useCallback(async (userId?: string) => {
    if (!userId && !user?.id) return null;
    
    const targetUserId = userId || user?.id;
    if (!targetUserId) return null;

    try {
      console.log('🔄 Refreshing user data for:', targetUserId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        console.error('❌ Error fetching profile data:', error);
        return null;
      }

      const userData = createUserObject(profileData);
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      
      console.log('✅ User data refreshed');
      return userData;
    } catch (error) {
      console.error('❌ Error in refreshUserData:', error);
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    let authSubscription: any = null;

    const initAuth = async () => {
      try {
        console.log('🚀 Initializing simplified auth...');
        
        // Set up auth listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!mounted) return;
            
            console.log('🔔 Auth state change:', event, session?.user?.email);
            
            if (event === "SIGNED_OUT" || !session?.user) {
              console.log('👋 User signed out or no session');
              setUser(null);
              localStorage.removeItem("user");
              setIsLoading(false);
              setAuthChecked(true);
              return;
            }
            
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
              console.log(`🔐 User ${event}:`, session.user.email);
              
              // Use setTimeout to avoid auth deadlocks
              setTimeout(async () => {
                if (!mounted) return;
                
                try {
                  const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                  
                  if (error) {
                    console.error('❌ Profile fetch error:', error);
                  } else if (profile && mounted) {
                    const userData = createUserObject(profile);
                    setUser(userData);
                    localStorage.setItem("user", JSON.stringify(userData));
                  }
                } catch (err) {
                  console.error('❌ Error in auth state handler:', err);
                } finally {
                  if (mounted) {
                    setIsLoading(false);
                    setAuthChecked(true);
                  }
                }
              }, 0);
            }
          }
        );
        
        authSubscription = subscription;
        
        // Check existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          if (mounted) {
            await clearAuthState();
          }
          return;
        }
        
        if (session?.user && mounted) {
          console.log('📋 Found existing session for:', session.user.email);
          
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error('❌ Profile error:', profileError);
          } else if (profileData && mounted) {
            const userData = createUserObject(profileData);
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        }
        
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) await clearAuthState();
      } finally {
        if (mounted) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [clearAuthState]);

  return {
    user,
    isLoading,
    authChecked,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    refreshUserData,
    clearAuthState
  };
}
