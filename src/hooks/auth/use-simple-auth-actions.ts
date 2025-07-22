
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';

export function useSimpleAuthActions() {
  const [isLoading, setIsLoading] = useState(false);

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setIsLoading(true);
    
    try {
      console.log('📝 SimpleAuth: Starting signup for:', email);
      
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
            ...userData
          }
        }
      });

      if (error) {
        console.error('❌ SimpleAuth: Signup error:', error);
        return { error };
      }

      console.log('✅ SimpleAuth: Signup successful');
      return { data, error: null };
      
    } catch (error: any) {
      console.error('❌ SimpleAuth: Signup exception:', error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log('🔐 SimpleAuth: Starting signin for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ SimpleAuth: Signin error:', error);
        return { error };
      }

      console.log('✅ SimpleAuth: Signin successful');
      return { data, error: null };
      
    } catch (error: any) {
      console.error('❌ SimpleAuth: Signin exception:', error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    
    try {
      console.log('👋 SimpleAuth: Starting signout');
      
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ SimpleAuth: Signout error:', error);
        return { error };
      }

      // Clear localStorage
      localStorage.removeItem('user');
      
      console.log('✅ SimpleAuth: Signout successful');
      return { error: null };
      
    } catch (error: any) {
      console.error('❌ SimpleAuth: Signout exception:', error);
      return { error };
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
