import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User as AppUser } from '@/types';
import { createUserObject } from '@/lib/auth-helpers';

// Ultra-simple auth state - no caching, no localStorage interference, no managers
export function useNuclearAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [processingVerification, setProcessingVerification] = useState(false);

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
      
      console.log('🔔 Nuclear Auth: Auth event:', event);
      
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  const signup = async (userData: Partial<AppUser>, password: string) => {
    if (!userData.email) throw new Error("Email is required");
    
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        // Use production domain consistently - never dynamic URLs
        emailRedirectTo: `https://marketplace.sourcecodeals.com/pending-approval`,
        data: {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          company: userData.company || '',
          website: userData.website || '',
          phone_number: userData.phone_number || '',
          buyer_type: userData.buyer_type || 'corporate',
          linkedin_profile: userData.linkedin_profile || '',
          ideal_target_description: userData.ideal_target_description || '',
          business_categories: JSON.stringify(userData.business_categories || []),
          target_locations: userData.target_locations || '',
          revenue_range_min: userData.revenue_range_min,
          revenue_range_max: userData.revenue_range_max,
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

    console.log('✅ User signup completed, verification email sent by Supabase only');
    
    // Send admin notification about new user registration (but don't trigger reminder emails)
    if (data.user && !data.session) {
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
        console.log('✅ Admin notification sent for new user registration');
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

  return {
    user,
    isLoading,
    authChecked,
    processingVerification,
    setProcessingVerification,
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    login,
    logout,
    signup,
    updateUserProfile,
    refreshUserProfile: async () => {
      setProcessingVerification(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          // Simple user object update
          const updatedUser = createUserObject(profile);
          setUser(updatedUser);
        }
      }
      setProcessingVerification(false);
    }
  };
}
