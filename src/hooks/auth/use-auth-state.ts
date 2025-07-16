
import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User as AppUser } from '@/types';
import { createUserObject, isUserAdmin } from '@/lib/auth-helpers';

export function useAuthState() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Use ref to track subscription to prevent memory leaks
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const mountedRef = useRef(true);

  const fetchUserProfile = async (session: Session | null): Promise<AppUser | null> => {
    if (!session?.user?.id) {
      return null;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (!profile) {
        console.warn('No profile found for user:', session.user.id);
        return null;
      }

      return createUserObject(profile);
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
        }

        if (mounted) {
          const userProfile = await fetchUserProfile(session);
          if (mounted) {
            setUser(userProfile);
            setIsLoading(false);
            setAuthChecked(true);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    // Set up auth state listener with proper cleanup
    const setupAuthListener = () => {
      // Clean up existing subscription if any
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change:', event);
          
          if (!mountedRef.current) return;

          try {
            let userProfile: AppUser | null = null;
            
            if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
              // Use setTimeout to prevent Supabase auth deadlocks
              setTimeout(async () => {
                if (mountedRef.current) {
                  userProfile = await fetchUserProfile(session);
                  if (mountedRef.current) {
                    setUser(userProfile);
                    setIsLoading(false);
                    setAuthChecked(true);
                  }
                }
              }, 0);
            } else if (event === 'SIGNED_OUT') {
              if (mountedRef.current) {
                setUser(null);
                setIsLoading(false);
                setAuthChecked(true);
              }
            }
          } catch (error) {
            console.error('Error in auth state change handler:', error);
            if (mountedRef.current) {
              setUser(null);
              setIsLoading(false);
              setAuthChecked(true);
            }
          }
        }
      );

      subscriptionRef.current = subscription;
    };

    initializeAuth();
    setupAuthListener();

    return () => {
      mounted = false;
      mountedRef.current = false;
      
      // Clean up subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);

  const isAdmin = isUserAdmin(user);
  const isBuyer = user?.role === 'buyer';

  return {
    user,
    isLoading,
    isAdmin,
    isBuyer,
    authChecked,
  };
}
