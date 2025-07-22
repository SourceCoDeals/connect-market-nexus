
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';

export function useSimpleAuthActions() {
  const [isLoading, setIsLoading] = useState(false);

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setIsLoading(true);
    
    try {
      console.log('📝 Starting signup process for:', email);
      
      const sanitizedBusinessCategories = Array.isArray(userData.business_categories) 
        ? JSON.stringify(userData.business_categories)
        : '[]';

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email-handler`,
          data: {
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            company: userData.company || '',
            website: userData.website || '',
            phone_number: userData.phone_number || '',
            buyer_type: userData.buyer_type || 'corporate',
            linkedin_profile: userData.linkedin_profile || '',
            ideal_target_description: userData.ideal_target_description || '',
            business_categories: sanitizedBusinessCategories,
            target_locations: userData.target_locations || '',
            revenue_range_min: userData.revenue_range_min,
            revenue_range_max: userData.revenue_range_max,
            specific_business_search: userData.specific_business_search || '',
            ...(userData.estimated_revenue && { estimated_revenue: userData.estimated_revenue }),
            ...(userData.fund_size && { fund_size: userData.fund_size }),
            ...(userData.investment_size && { investment_size: userData.investment_size }),
            ...(userData.aum && { aum: userData.aum }),
            ...(userData.is_funded && { is_funded: userData.is_funded }),
            ...(userData.funded_by && { funded_by: userData.funded_by }),
            ...(userData.target_company_size && { target_company_size: userData.target_company_size }),
            ...(userData.funding_source && { funding_source: userData.funding_source }),
            ...(userData.needs_loan && { needs_loan: userData.needs_loan }),
            ...(userData.ideal_target && { ideal_target: userData.ideal_target }),
          }
        }
      });

      if (error) {
        console.error('❌ Signup error:', error);
        return { error };
      }

      console.log('✅ Signup successful for:', email);
      return { data, error: null };
      
    } catch (error: any) {
      console.error('❌ Signup exception:', error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log('🔐 Starting signin process for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Signin error:', error);
        return { error };
      }

      console.log('✅ Signin successful for:', email);
      return { data, error: null };
      
    } catch (error: any) {
      console.error('❌ Signin exception:', error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    
    try {
      console.log('👋 Starting fast signout process');
      
      // Clear local state immediately
      localStorage.removeItem("user");
      
      // Sign out from Supabase (don't wait for it)
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ Signout error (continuing anyway):', error);
        // Don't throw - local state is already cleared
      }

      console.log('✅ Signout completed');
      return { error: null };
      
    } catch (error: any) {
      console.error('❌ Signout exception (continuing anyway):', error);
      // Don't throw - local state is already cleared
      return { error: null };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signUp,
    signIn,
    signOut,
    isLoading
  };
}
