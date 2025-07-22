
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
      
      // Only update localStorage if the data has actually changed
      const currentStoredUser = localStorage.getItem("user");
      const newUserString = JSON.stringify(userData);
      
      if (currentStoredUser !== newUserString) {
        localStorage.setItem("user", newUserString);
      }
      
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
        setIsLoading(true);

        // Set up auth state listener first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔔 Auth state change:', event, session?.user?.email);
            
            if (!isSubscribed) return;

            if (event === "SIGNED_OUT") {
              console.log('👋 User signed out');
              setUser(null);
              localStorage.removeItem("user");
              setIsLoading(false);
              setAuthChecked(true);
              return;
            }

            if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
              console.log(`🔐 User ${event}:`, session.user.email);
              
              // Use setTimeout to prevent Supabase deadlocks
              setTimeout(async () => {
                if (!isSubscribed) return;
                
                const freshUserData = await refreshUserData(session.user.id);
                if (freshUserData && isSubscribed) {
                  console.log('🎯 Setting fresh user data:', {
                    email: freshUserData.email,
                    email_verified: freshUserData.email_verified,
                    approval_status: freshUserData.approval_status
                  });
                  setUser(freshUserData);
                }
                
                setIsLoading(false);
                setAuthChecked(true);
              }, 100);
            }
          }
        );

        authSubscription = subscription;

        // Check for existing session with simplified logic
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Session error:', error);
          await clearAuthState();
          return;
        }

        if (session?.user && isSubscribed) {
          console.log('🔍 Found existing session for:', session.user.email);
          
          // Always fetch fresh profile data on initialization
          const freshUserData = await refreshUserData(session.user.id);
          if (freshUserData && isSubscribed) {
            console.log('🎯 Setting initial user data:', {
              email: freshUserData.email,
              email_verified: freshUserData.email_verified,
              approval_status: freshUserData.approval_status
            });
            setUser(freshUserData);
          }
        } else {
          console.log('❌ No existing session found');
          if (isSubscribed) {
            setUser(null);
            localStorage.removeItem("user");
          }
        }
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
