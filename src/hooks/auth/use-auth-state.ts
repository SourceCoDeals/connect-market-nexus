
import { useState, useEffect } from "react";
import { User, ApprovalStatus } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { createUserObject } from "@/lib/auth-helpers";
import { logger } from '@/lib/logger';

/**
 * Manages Supabase authentication state, including session checking, profile fetching, and real-time auth event handling.
 * Uses localStorage caching to prevent UI flashing on page load, and includes a 3-second timeout fallback.
 *
 * @returns `user` (current User object or null), `isLoading`, `isAdmin`, `isBuyer`, and `authChecked` flags
 *
 * @example
 * ```ts
 * const { user, isLoading, isAdmin, authChecked } = useAuthState();
 * if (!authChecked) return <Spinner />;
 * if (!user) return <LoginPage />;
 * ```
 */
export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    
    // First check if we have a user in localStorage to avoid flashing
    try {
      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        setUser(parsedUser);
        // Loaded cached user
      }
    } catch (err) {
      logger.error('Error parsing cached user', 'useAuthState', { error: String(err) });
      localStorage.removeItem("user");
    }
    
    // Set up the auth state change listener before checking the session
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Auth state change
          
          if (!isSubscribed) return;
          
          // Update state synchronously to prevent race conditions
          if (event === "SIGNED_OUT") {
            // User signed out, clearing state
            setUser(null);
            localStorage.removeItem("user");
            setIsLoading(false);
            setAuthChecked(true);
            return;
          }
          
          if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session) {
            // User auth event occurred
            // Use setTimeout to avoid Supabase auth deadlocks and fix memory leaks
            setTimeout(async () => {
              if (!isSubscribed) return;
              
              try {
                const { data: profile, error } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                if (error) {
                  logger.error(`Error fetching profile after ${event}`, 'useAuthState', { error: String(error) });
                  // Create a minimal user object if profile doesn't exist yet
                  const minimalUser: User = {
                    id: session.user.id,
                    email: session.user.email || '',
                    first_name: session.user.user_metadata?.first_name || '',
                    last_name: session.user.user_metadata?.last_name || '',
                    email_verified: session.user.email_confirmed_at !== null,
                    approval_status: 'pending' as ApprovalStatus,
                    is_admin: false,
                    role: 'buyer' as const,
                    created_at: session.user.created_at,
                    updated_at: new Date().toISOString(),
                    company: '',
                    website: '',
                    phone_number: '',
                    buyer_type: 'corporate' as const,
                    company_name: undefined,
                    estimated_revenue: undefined,
                    fund_size: undefined,
                    investment_size: undefined,
                    aum: undefined,
                    is_funded: undefined,
                    funded_by: undefined,
                    target_company_size: undefined,
                    funding_source: undefined,
                    needs_loan: undefined,
                    ideal_target: undefined,
                    bio: undefined,
                    // Computed properties
                    firstName: session.user.user_metadata?.first_name || '',
                    lastName: session.user.user_metadata?.last_name || '',
                    phoneNumber: '',
                    isAdmin: false,
                    buyerType: 'corporate' as const,
                    emailVerified: session.user.email_confirmed_at !== null,
                    isApproved: false,
                    createdAt: session.user.created_at,
                    updatedAt: new Date().toISOString()
                  };
                  setUser(minimalUser);
                  localStorage.setItem("user", JSON.stringify(minimalUser));
                } else if (profile && isSubscribed) {
                  const userData = createUserObject(profile);
                  // Setting user data after auth event
                  setUser(userData);
                  localStorage.setItem("user", JSON.stringify(userData));
                }
              } catch (err) {
                logger.error(`Error in ${event} handler`, 'useAuthState', { error: String(err) });
                setUser(null);
                localStorage.removeItem("user");
              } finally {
                if (isSubscribed) {
                  setIsLoading(false);
                  setAuthChecked(true);
                }
              }
            }, 0);
          }
        }
      );
      
      authSubscription = subscription;
      return subscription;
    };
    
    setupAuthListener();
    
    const checkSession = async () => {
      try {
        setIsLoading(true);
        
        // Timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (isSubscribed) {
            logger.warn('Auth check timeout - forcing completion', 'useAuthState');
            setIsLoading(false);
            setAuthChecked(true);
          }
        }, 3000);
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Clear timeout as we got a response
        clearTimeout(timeoutId);
        
        if (sessionError) {
          logger.error('Session error', 'useAuthState', { error: String(sessionError) });
          setUser(null);
          localStorage.removeItem("user");
          setIsLoading(false);
          setAuthChecked(true);
          return;
        }
        
        if (session?.user && isSubscribed) {
          // Found existing session
          // Fetch user profile data
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            logger.error('Profile error', 'useAuthState', { error: String(profileError) });
            // Create minimal user object for users without profiles yet
            const minimalUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              first_name: session.user.user_metadata?.first_name || '',
              last_name: session.user.user_metadata?.last_name || '',
              email_verified: session.user.email_confirmed_at !== null,
              approval_status: 'pending' as ApprovalStatus,
              is_admin: false,
              role: 'buyer' as const,
              created_at: session.user.created_at,
              updated_at: new Date().toISOString(),
              company: '',
              website: '',
              phone_number: '',
              buyer_type: 'corporate' as const,
              company_name: undefined,
              estimated_revenue: undefined,
              fund_size: undefined,
              investment_size: undefined,
              aum: undefined,
              is_funded: undefined,
              funded_by: undefined,
              target_company_size: undefined,
              funding_source: undefined,
              needs_loan: undefined,
              ideal_target: undefined,
              bio: undefined,
              // Computed properties
              firstName: session.user.user_metadata?.first_name || '',
              lastName: session.user.user_metadata?.last_name || '',
              phoneNumber: '',
              isAdmin: false,
              buyerType: 'corporate' as const,
              emailVerified: session.user.email_confirmed_at !== null,
              isApproved: false,
              createdAt: session.user.created_at,
              updatedAt: new Date().toISOString()
            };
            setUser(minimalUser);
            localStorage.setItem("user", JSON.stringify(minimalUser));
          } else if (profileData && isSubscribed) {
            // Loaded profile data
            const userData = createUserObject(profileData);
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          // No session found
          if (isSubscribed) {
            setUser(null);
            localStorage.removeItem("user");
          }
        }
      } catch (error) {
        logger.error('Auth check error', 'useAuthState', { error: String(error) });
        if (isSubscribed) {
          setUser(null);
          localStorage.removeItem("user");
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };
    
    // Initialize by checking the session
    checkSession();
    
    // Enhanced cleanup function to prevent memory leaks
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
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}
