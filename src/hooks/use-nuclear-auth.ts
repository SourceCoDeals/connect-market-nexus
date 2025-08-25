import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User as AppUser } from '@/types';
import { createUserObject } from '@/lib/auth-helpers';
import { parseCurrency } from '@/lib/currency-utils';

// Ultra-simple auth state - no caching, no localStorage interference, no managers
export function useNuclearAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Simplified - no early token detection in auth hook
    // Let PendingApproval page handle all verification scenarios

    // Simple session check - no complex initialization
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (session?.user) {
          // Fetch profile data directly
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && isMounted) {
            const appUser = createUserObject(profile);
            setUser(appUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setAuthChecked(true);
        }
      }
    };

    // Simple auth state listener - NO async operations inside
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      // Nuclear Auth: Auth event
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
        setAuthChecked(true);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Defer profile loading to prevent deadlocks
        setTimeout(() => {
          if (isMounted) {
            checkSession();
          }
        }, 100);
      }
    });

    // Initial check
    checkSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // No dependencies to prevent re-initialization

  // Simple auth actions
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      // Starting logout process
      
      // Step 1: Clear user state immediately to prevent UI confusion
      setUser(null);
      setIsLoading(true);
      
      // Step 2: Clean up auth state synchronously
      const { cleanupAuthState } = await import('@/lib/auth-cleanup');
      cleanupAuthState();
      
      // Step 3: Sign out from Supabase with global scope
      try {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.warn('Supabase logout warning:', error);
        }
      } catch (signOutError) {
        console.warn('Supabase signOut failed, continuing with cleanup:', signOutError);
      }
      
      // Logout completed successfully
      
      // Step 4: Navigate immediately without delay
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure navigation happens even on error
      setUser(null);
      window.location.href = '/login';
    }
  };

  const signup = async (userData: Partial<AppUser>, password: string) => {
    if (!userData.email) throw new Error("Email is required");
    
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          company: userData.company || '',
          website: userData.website || '',
          phone_number: userData.phone_number || '',
          buyer_type: userData.buyer_type || 'corporate',
          linkedin_profile: userData.linkedin_profile || '',
          ideal_target_description: userData.ideal_target_description || '',
          business_categories: Array.isArray(userData.business_categories) ? userData.business_categories : [],
          target_locations: Array.isArray(userData.target_locations) ? (userData.target_locations as any) : [],
          revenue_range_min: typeof userData.revenue_range_min === 'number' 
            ? userData.revenue_range_min 
            : parseCurrency(String(userData.revenue_range_min ?? '')),
          revenue_range_max: typeof userData.revenue_range_max === 'number' 
            ? userData.revenue_range_max 
            : parseCurrency(String(userData.revenue_range_max ?? '')),
          specific_business_search: userData.specific_business_search || '',
          // Additional fields for different buyer types
          estimated_revenue: userData.estimated_revenue || '',
          fund_size: userData.fund_size || '',
          investment_size: userData.investment_size || '',
          aum: userData.aum || '',
          is_funded: userData.is_funded || '',
          funded_by: userData.funded_by || '',
          target_company_size: userData.target_company_size || '',
          funding_source: userData.funding_source || '',
          needs_loan: userData.needs_loan || '',
          ideal_target: userData.ideal_target || '',
        }
      }
    });
    
    if (error) throw error;

    // User signup completed, verification email sent by Supabase
    
    // Send admin notification about new user registration
    if (data.user) {
      try {
        const adminNotificationPayload = {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email,
          company: userData.company || ''
        };
        
        await supabase.functions.invoke('admin-notification', {
          body: adminNotificationPayload
        });
        // Admin notification sent for new user registration
      } catch (notificationError) {
        console.warn('Admin notification failed but user creation succeeded:', notificationError);
      }
    }
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    if (!user) throw new Error("No user logged in");

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (error) throw error;
    
    // Simple refresh
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        // Update user state with new data
        const updatedUser = createUserObject(profile);
        setUser(updatedUser);
      }
    }
  };

  const refreshUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        const updatedUser = createUserObject(profile);
        setUser(updatedUser);
      }
    }
  };

  return {
    user,
    login,
    logout,
    signup,
    updateUserProfile,
    refreshUserProfile,
    isLoading,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}