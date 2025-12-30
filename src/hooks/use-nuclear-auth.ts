
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User as AppUser } from '@/types';
import { createUserObject } from '@/lib/auth-helpers';
import { parseCurrency } from '@/lib/currency-utils';
import { toStandardCategory, toStandardLocation, standardizeCategories, standardizeLocations } from '@/lib/standardization';
import { processUrl } from '@/lib/url-utils';

// Ultra-simple auth state - no caching, no localStorage interference, no managers
export function useNuclearAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Simplified - no early token detection in auth hook
    // Let PendingApproval page handle all verification scenarios

    // Simple session check with self-healing for missing profiles
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (session?.user) {
          // Fetch profile data directly
          let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // Self-healing: if profile missing, create one from auth metadata
          if (!profile && (profileError?.code === 'PGRST116' || !profileError)) {
            console.log('Profile missing, attempting self-heal for:', session.user.email);
            const meta = session.user.user_metadata || {};
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .upsert({
                id: session.user.id,
                email: session.user.email || '',
                first_name: meta.first_name || meta.firstName || 'Unknown',
                last_name: meta.last_name || meta.lastName || 'User',
                company: meta.company || '',
                buyer_type: meta.buyer_type || meta.buyerType || 'individual',
                website: meta.website || '',
                linkedin_profile: meta.linkedin_profile || meta.linkedinProfile || '',
                approval_status: 'pending',
                email_verified: !!session.user.email_confirmed_at,
              }, { onConflict: 'id' })
              .select()
              .single();
            
            if (insertError) {
              console.error('Self-heal profile creation failed:', insertError);
            } else {
              console.log('Self-healed profile created successfully');
              profile = newProfile;
            }
          }

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

    // Normalize website if present (allow example.com or www.example.com)
    const websiteNormalized =
      userData.website && userData.website.trim() !== ''
        ? processUrl(userData.website)
        : '';

    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          company: userData.company || '',
          website: websiteNormalized,
          phone_number: userData.phone_number || '',
          buyer_type: userData.buyer_type || 'corporate',
          linkedin_profile: userData.linkedin_profile || '',
          ideal_target_description: userData.ideal_target_description || '',
          business_categories: Array.isArray(userData.business_categories) ? standardizeCategories(userData.business_categories) : [],
          target_locations: Array.isArray(userData.target_locations) ? standardizeLocations(userData.target_locations as any) : [],
          revenue_range_min: (userData.revenue_range_min as any) || '', 
          revenue_range_max: (userData.revenue_range_max as any) || '',
          specific_business_search: userData.specific_business_search || '',
          // Missing job_title field
          job_title: userData.job_title || '',
          // Additional fields for different buyer types
          estimated_revenue: userData.estimated_revenue || '',
          fund_size: userData.fund_size || '',
          // Ensure investment_size is an array (no stringification)
          investment_size: Array.isArray(userData.investment_size)
            ? userData.investment_size
            : userData.investment_size
              ? [userData.investment_size as any]
              : [],
          aum: userData.aum || '',
          is_funded: userData.is_funded || '',
          funded_by: userData.funded_by || '',
          target_company_size: userData.target_company_size || '',
          funding_source: userData.funding_source || '',
          needs_loan: userData.needs_loan || '',
          ideal_target: userData.ideal_target || '',
          // All comprehensive buyer-specific fields
          // Private Equity
          deploying_capital_now: userData.deploying_capital_now || '',
          // Corporate Development
          owning_business_unit: userData.owning_business_unit || '',
          deal_size_band: userData.deal_size_band || '',
          integration_plan: Array.isArray(userData.integration_plan) ? userData.integration_plan : [],
          corpdev_intent: userData.corpdev_intent || '',
          // Family Office
          discretion_type: userData.discretion_type || '',
          // Independent Sponsor
          committed_equity_band: userData.committed_equity_band || '',
          equity_source: Array.isArray(userData.equity_source) ? userData.equity_source : [],
          deployment_timing: userData.deployment_timing || '',
          target_deal_size_min: typeof userData.target_deal_size_min === 'number' ? userData.target_deal_size_min : (userData.target_deal_size_min ? Number(userData.target_deal_size_min) : null),
          target_deal_size_max: typeof userData.target_deal_size_max === 'number' ? userData.target_deal_size_max : (userData.target_deal_size_max ? Number(userData.target_deal_size_max) : null),
          geographic_focus: Array.isArray(userData.geographic_focus) ? standardizeLocations(userData.geographic_focus) : [],
          industry_expertise: Array.isArray(userData.industry_expertise) ? standardizeCategories(userData.industry_expertise) : [],
          deal_structure_preference: userData.deal_structure_preference || '',
          permanent_capital: userData.permanent_capital || null,
          operating_company_targets: Array.isArray(userData.operating_company_targets) ? userData.operating_company_targets : [],
          flex_subxm_ebitda: userData.flex_subxm_ebitda || null,
          // Search Fund
          search_type: userData.search_type || '',
          acq_equity_band: userData.acq_equity_band || '',
          financing_plan: Array.isArray(userData.financing_plan) ? userData.financing_plan : [],
          search_stage: userData.search_stage || '',
          flex_sub2m_ebitda: userData.flex_sub2m_ebitda || null,
          // Advisor/Banker
          on_behalf_of_buyer: userData.on_behalf_of_buyer || '',
          buyer_role: userData.buyer_role || '',
          buyer_org_url: userData.buyer_org_url || '',
          // Business Owner
          owner_timeline: userData.owner_timeline || '',
          owner_intent: userData.owner_intent || '',
          // Individual Investor
          uses_bank_finance: userData.uses_bank_finance || '',
          max_equity_today_band: userData.max_equity_today_band || '',
          // Additional comprehensive fields
          mandate_blurb: userData.mandate_blurb || '',
          portfolio_company_addon: userData.portfolio_company_addon || '',
          backers_summary: userData.backers_summary || '',
          anchor_investors_summary: userData.anchor_investors_summary || '',
          // Special fields to ensure correct capture and snapshot
          deal_intent: userData.deal_intent || '',
          exclusions: Array.isArray(userData.exclusions)
            ? userData.exclusions
            : (typeof userData.exclusions === 'string' && userData.exclusions
                ? (userData.exclusions as string).split(',').map(s => s.trim()).filter(Boolean)
                : []),
          include_keywords: Array.isArray(userData.include_keywords)
            ? userData.include_keywords
            : (typeof userData.include_keywords === 'string' && userData.include_keywords
                ? (userData.include_keywords as string).split(',').map(s => s.trim()).filter(Boolean)
                : []),
          // Referral source tracking (Step 3 - How did you hear about us?)
          referral_source: userData.referral_source || '',
          referral_source_detail: userData.referral_source_detail || '',
          // Deal sourcing questions (Step 3)
          deal_sourcing_methods: Array.isArray(userData.deal_sourcing_methods) ? userData.deal_sourcing_methods : [],
          target_acquisition_volume: userData.target_acquisition_volume || '',
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

    // Normalize website if provided
    const normalizedWebsite =
      data.website && data.website.trim() !== '' ? processUrl(data.website) : undefined;

    // Ensure investment_size is sent as proper JSON/array (not stringified)
    const { investment_size, ...restData } = data;

    let preparedInvestmentSize: any = undefined;
    if (Array.isArray(investment_size)) {
      preparedInvestmentSize = investment_size;
    } else if (typeof investment_size === 'string' && investment_size.trim() !== '') {
      // If it looks like a JSON array, try to parse; otherwise wrap as array
      const trimmed = investment_size.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          preparedInvestmentSize = JSON.parse(trimmed);
        } catch {
          preparedInvestmentSize = [trimmed];
        }
      } else {
        preparedInvestmentSize = [trimmed];
      }
    }

    const dbPayload: Record<string, any> = {
      ...restData,
      ...(normalizedWebsite !== undefined ? { website: normalizedWebsite } : {}),
      ...(preparedInvestmentSize !== undefined ? { investment_size: preparedInvestmentSize } : {}),
    };

    const { error } = await supabase
      .from('profiles')
      .update(dbPayload)
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
    // SECURITY NOTE: is_admin flag is auto-synced from user_roles table via database trigger
    // Source of truth is user_roles table, this flag is kept in sync automatically
    isAdmin: user?.is_admin === true,
    isBuyer: user?.role === "buyer",
    authChecked,
  };
}
