// PHASE 3: Enhanced Auth State Hook
// Uses the new auth state manager for improved reliability

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { 
  validateSession, 
  safeRefreshUserData, 
  debouncedAuthSync, 
  safeAuthCleanup,
  checkAuthConsistency 
} from "@/lib/auth-state-manager";

export function useEnhancedAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Use refs to prevent stale closures in auth listeners
  const userRef = useRef<User | null>(null);
  const isLoadingRef = useRef(true);
  
  // Update refs when state changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // PHASE 3: Enhanced refresh with consistency checking
  const refreshUserData = useCallback(async (userId?: string, force = false) => {
    try {
      const targetUserId = userId || userRef.current?.id;
      if (!targetUserId) {
        console.warn('No user ID available for refresh');
        return null;
      }

      // Check auth consistency first
      const { isConsistent, action } = await checkAuthConsistency();
      
      if (!isConsistent) {
        console.log(`🔧 Auth inconsistency detected, action: ${action}`);
        
        switch (action) {
          case 'clear_localStorage':
            localStorage.removeItem("user");
            break;
          case 'clear_all':
            await safeAuthCleanup();
            setUser(null);
            return null;
          case 'refresh_user':
            // Continue with refresh
            break;
        }
      }

      const freshUserData = await safeRefreshUserData(targetUserId, force);
      if (freshUserData) {
        setUser(freshUserData);
        return freshUserData;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error in enhanced refreshUserData:', error);
      return null;
    }
  }, []);

  // PHASE 3: Enhanced clear with proper cleanup
  const clearAuthState = useCallback(async () => {
    console.log('🧹 Enhanced auth state clearing');
    await safeAuthCleanup();
    setUser(null);
    setIsLoading(false);
    setAuthChecked(true);
  }, []);

  // PHASE 3: Enhanced initialization with race condition protection
  useEffect(() => {
    let isSubscribed = true;
    let authSubscription: any = null;
    let initializationPromise: Promise<void> | null = null;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Enhanced auth initialization...');
        setIsLoading(true);

        // PHASE 3: Check auth consistency on startup
        const { isConsistent, action } = await checkAuthConsistency();
        
        if (!isConsistent) {
          console.log(`🔧 Startup inconsistency detected: ${action}`);
          
          if (action === 'clear_all' || action === 'clear_localStorage') {
            await safeAuthCleanup();
            if (isSubscribed) {
              setUser(null);
              setIsLoading(false);
              setAuthChecked(true);
            }
            return;
          }
        }

        // Validate session with enhanced session manager
        const { isValid, session, needsRefresh } = await validateSession();
        
        console.log('📋 Enhanced session check:', {
          isValid,
          needsRefresh,
          userEmail: session?.user?.email
        });

        // Load user data if session is valid
        if (isValid && session?.user && isSubscribed) {
          console.log('🔍 Loading user data for session:', session.user.email);
          
          const freshUserData = await safeRefreshUserData(session.user.id, needsRefresh);
          if (freshUserData && isSubscribed) {
            console.log('✅ Enhanced user data loaded');
            setUser(freshUserData);
          }
        } else if (isSubscribed) {
          console.log('❌ No valid session');
          setUser(null);
          localStorage.removeItem("user");
        }

      } catch (error) {
        console.error('❌ Enhanced auth initialization error:', error);
        if (isSubscribed) {
          await clearAuthState();
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    // Set up auth state listener with debouncing
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('🔔 Enhanced auth state change:', event);
          
          if (!isSubscribed) return;

          // Use debounced sync to prevent race conditions
          debouncedAuthSync(async () => {
            if (event === "SIGNED_OUT") {
              console.log('👋 User signed out - enhanced cleanup');
              setUser(null);
              localStorage.removeItem("user");
            } else if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
              console.log(`🔐 Enhanced ${event}:`, session.user.email);
              
              const freshUserData = await safeRefreshUserData(session.user.id, true);
              if (freshUserData && isSubscribed) {
                console.log('✅ Enhanced user data updated after auth change');
                setUser(freshUserData);
              }
            }
          }, 200);
        }
      );

      authSubscription = subscription;
    };

    // Initialize auth and set up listener
    initializationPromise = initializeAuth().then(() => {
      if (isSubscribed) {
        setupAuthListener();
      }
    });

    return () => {
      isSubscribed = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

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