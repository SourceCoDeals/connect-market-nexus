
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { cleanupAuthState } from '@/lib/auth-helpers';
import { toast } from '@/hooks/use-toast';

export function useEnhancedAuthActions() {
  const [isLoading, setIsLoading] = useState(false);

  const signUp = async (email: string, password: string, userData: Partial<User>) => {
    setIsLoading(true);
    
    try {
      console.log('📝 Starting signup process for:', email);
      
      // Clean up any existing auth state first
      await cleanupAuthState();
      
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
      
      // Clean up any existing auth state first
      await cleanupAuthState();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Signin error:', error);
        return { error };
      }

      console.log('✅ Signin successful for:', email);
      
      // The auth state will be handled by the useFreshAuthState hook
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
      console.log('👋 Starting signout process');
      
      // Clean up auth state first
      await cleanupAuthState();
      
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ Signout error:', error);
        return { error };
      }

      console.log('✅ Signout successful');
      return { error: null };
      
    } catch (error: any) {
      console.error('❌ Signout exception:', error);
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
