
import { useState, useEffect } from 'react';
import { User } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { createUserObject } from '@/lib/auth-helpers';

export function useSimpleAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    console.log('🚀 SimpleAuth: Initializing...');
    
    let isSubscribed = true;

    const loadUserData = async (userId: string) => {
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error || !profileData || !isSubscribed) {
          return null;
        }

        const userData = createUserObject(profileData);
        localStorage.setItem('user', JSON.stringify(userData));
        return userData;
      } catch (error) {
        console.error('❌ SimpleAuth: Error loading user data:', error);
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ SimpleAuth: Session error:', error);
          if (isSubscribed) {
            setUser(null);
            setIsLoading(false);
            setAuthChecked(true);
          }
          return;
        }

        if (session?.user && isSubscribed) {
          console.log('✅ SimpleAuth: Session found, loading user data');
          const userData = await loadUserData(session.user.id);
          if (userData && isSubscribed) {
            setUser(userData);
          }
        } else if (isSubscribed) {
          console.log('❌ SimpleAuth: No session found');
          setUser(null);
          localStorage.removeItem('user');
        }

        if (isSubscribed) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error('❌ SimpleAuth: Initialization error:', error);
        if (isSubscribed) {
          setUser(null);
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;

        console.log('🔔 SimpleAuth: Auth event:', event);
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('user');
        } else if (event === 'SIGNED_IN' && session?.user) {
          const userData = await loadUserData(session.user.id);
          if (userData && isSubscribed) {
            setUser(userData);
          }
        }
      }
    );

    // Initialize
    initializeAuth();

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserData = async (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return null;

    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error || !profileData) {
        return null;
      }

      const userData = createUserObject(profileData);
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error('❌ SimpleAuth: Refresh error:', error);
      return null;
    }
  };

  const clearAuthState = async () => {
    console.log('🧹 SimpleAuth: Clearing auth state');
    setUser(null);
    localStorage.removeItem('user');
    setAuthChecked(true);
  };

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
