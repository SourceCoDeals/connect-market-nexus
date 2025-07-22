
import { useState, useEffect, useCallback } from "react";
import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject, cleanupAuthState } from "@/lib/auth-helpers";

export function useFreshAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Force refresh user data from database
  const refreshUserData = useCallback(async (userId: string) => {
    try {
      console.log('🔄 Refreshing user data for:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching fresh profile data:', error);
        return null;
      }

      console.log('✅ Fresh profile data fetched:', {
        email: profileData.email,
        email_verified: profileData.email_verified,
        approval_status: profileData.approval_status,
        is_admin: profileData.is_admin
       });

      const userData = createUserObject(profileData);
      localStorage.setItem("user", JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('❌ Error in refreshUserData:', error);
      return null;
    }
  }, []);

  // Clear all auth state and force fresh login
  const clearAuthState = useCallback(async () => {
    console.log('🧹 Clearing all auth state');
    await cleanupAuthState();
    setUser(null);
    setIsLoading(false);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Starting simplified auth initialization...');

        // Check for existing session immediately
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          if (isSubscribed) {
            await clearAuthState();
          }
          return;
        }

        console.log('📋 Session check:', {
          hasSession: !!session,
          userEmail: session?.user?.email
        });

        // If we have a session, load user data immediately
        if (session?.user && isSubscribed) {
          console.log('🔍 Loading user data for existing session:', session.user.email);
          
          const freshUserData = await refreshUserData(session.user.id);
          if (freshUserData && isSubscribed) {
            console.log('✅ User data loaded successfully');
            setUser(freshUserData);
          }
        } else if (isSubscribed) {
          console.log('❌ No session - user not authenticated');
          setUser(null);
          localStorage.removeItem("user");
        }

        // Set up auth state listener for future changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔔 Auth state change:', event);
            
            if (!isSubscribed) return;

            if (event === "SIGNED_OUT") {
              console.log('👋 User signed out');
              setUser(null);
              localStorage.removeItem("user");
            } else if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
              console.log(`🔐 User ${event}:`, session.user.email);
              
              const freshUserData = await refreshUserData(session.user.id);
              if (freshUserData && isSubscribed) {
                console.log('✅ Updated user data after auth change');
                setUser(freshUserData);
              }
            }
          }
        );

        authSubscription = subscription;

      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (isSubscribed) await clearAuthState();
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    initializeAuth();

    return () => {
      isSubscribed = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [refreshUserData, clearAuthState]);

  return {
    user,
    isLoading,
    authChecked,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    refreshUserData: user ? () => refreshUserData(user.id) : async () => null,
    clearAuthState
  };
}
