
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
      // Refreshing user data
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching fresh profile data:', error);
        return null;
      }

      // Fresh profile data fetched

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
    // Clearing all auth state
    await cleanupAuthState();
    setUser(null);
    setIsLoading(false);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    let authSubscription: any = null;

    // Define functions inside useEffect to avoid circular dependencies
    const internalRefreshUserData = async (userId: string) => {
      try {
        // Refreshing user data
        
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('❌ Error fetching fresh profile data:', error);
          return null;
        }

        // Fresh profile data fetched

        const userData = createUserObject(profileData);
        localStorage.setItem("user", JSON.stringify(userData));
        
        return userData;
      } catch (error) {
        console.error('❌ Error in refreshUserData:', error);
        return null;
      }
    };

    const internalClearAuthState = async () => {
      // Clearing auth state
      await cleanupAuthState();
      if (isSubscribed) {
        setUser(null);
        setIsLoading(false);
        setAuthChecked(true);
      }
    };

    const initializeAuth = async () => {
      try {
        // Starting auth initialization

        // Check for existing session immediately
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          if (isSubscribed) {
            await internalClearAuthState();
          }
          return;
        }

        // Session check

        // If we have a session, load user data immediately
        if (session?.user && isSubscribed) {
          // Loading user data for existing session
          
          const freshUserData = await internalRefreshUserData(session.user.id);
          if (freshUserData && isSubscribed) {
            // User data loaded successfully
            setUser(freshUserData);
          }
        } else if (isSubscribed) {
          // No session - user not authenticated
          setUser(null);
          localStorage.removeItem("user");
        }

        // Set up auth state listener for future changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            // Auth state change
            
            if (!isSubscribed) return;

            if (event === "SIGNED_OUT") {
              // User signed out
              setUser(null);
              localStorage.removeItem("user");
            } else if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
              // User auth event
              
              const freshUserData = await internalRefreshUserData(session.user.id);
              if (freshUserData && isSubscribed) {
                // Updated user data after auth change
                setUser(freshUserData);
              }
            }
          }
        );

        authSubscription = subscription;

      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (isSubscribed) await internalClearAuthState();
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
  }, []); // Remove dependencies to break circular loop

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
