
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { withPerformanceMonitoring } from '@/lib/performance-monitor';
import { errorLogger } from '@/lib/error-logger';

export function useEnhancedAuthActions() {
  const [isLoading, setIsLoading] = useState(false);

  const signUp = async (email: string, password: string, userData: any) => {
    return withPerformanceMonitoring('enhanced-signup', async () => {
      setIsLoading(true);
      try {
        console.log('🔐 Starting enhanced signup process for:', email);
        
        const redirectUrl = `${window.location.origin}/verify-email-handler`;
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: userData
          }
        });

        console.log('📧 Signup response:', { data, error });

        if (error) {
          console.error('❌ Signup error:', error);
          await errorLogger.logError(error, {
            context: 'enhanced-signup',
            email,
            userData: JSON.stringify(userData)
          });
          throw error;
        }

        console.log('✅ Signup successful for:', email);
        
        // Check if user needs to verify email
        if (data.user && !data.user.email_confirmed_at) {
          console.log('📧 User needs email verification, attempting to send custom verification email');
          
          // Try to send custom verification email if Supabase email failed
          try {
            const { error: emailError } = await supabase.functions.invoke('send-verification-email', {
              body: { 
                email: data.user.email,
                token: data.user.id, // Use user ID as token for now
                redirectTo: `${window.location.origin}/verify-email-handler`
              }
            });
            
            if (emailError) {
              console.error('❌ Failed to send custom verification email:', emailError);
            } else {
              console.log('✅ Custom verification email sent successfully');
            }
          } catch (customEmailError) {
            console.error('❌ Error sending custom verification email:', customEmailError);
          }
          
          toast({
            title: 'Account created successfully',
            description: 'Please check your email to verify your account. If you don\'t receive an email, try signing up again.',
          });
        } else {
          console.log('✅ User email already verified');
          toast({
            title: 'Account created successfully',
            description: 'Your account is ready for admin approval.',
          });
        }

        return { data, error: null };
      } catch (error: any) {
        console.error('💥 Enhanced signup failed:', error);
        await errorLogger.logError(error, {
          context: 'enhanced-signup-catch',
          email
        });
        
        toast({
          variant: 'destructive',
          title: 'Signup failed',
          description: error.message || 'An unexpected error occurred during signup.',
        });
        
        return { data: null, error };
      } finally {
        setIsLoading(false);
      }
    });
  };

  const signIn = async (email: string, password: string) => {
    return withPerformanceMonitoring('enhanced-signin', async () => {
      setIsLoading(true);
      try {
        console.log('🔐 Starting enhanced signin process for:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('❌ Signin error:', error);
          await errorLogger.logError(error, {
            context: 'enhanced-signin',
            email
          });
          throw error;
        }

        console.log('✅ Signin successful for:', email);
        
        toast({
          title: 'Welcome back!',
          description: 'You have been successfully signed in.',
        });

        return { data, error: null };
      } catch (error: any) {
        console.error('💥 Enhanced signin failed:', error);
        await errorLogger.logError(error, {
          context: 'enhanced-signin-catch',
          email
        });
        
        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: error.message || 'An unexpected error occurred during sign in.',
        });
        
        return { data: null, error };
      } finally {
        setIsLoading(false);
      }
    });
  };

  const signOut = async () => {
    return withPerformanceMonitoring('enhanced-signout', async () => {
      setIsLoading(true);
      try {
        console.log('🔐 Starting enhanced signout process');
        
        const { error } = await supabase.auth.signOut();

        if (error) {
          console.error('❌ Signout error:', error);
          await errorLogger.logError(error, {
            context: 'enhanced-signout'
          });
          throw error;
        }

        console.log('✅ Signout successful');
        
        toast({
          title: 'Signed out successfully',
          description: 'You have been logged out of your account.',
        });

        return { error: null };
      } catch (error: any) {
        console.error('💥 Enhanced signout failed:', error);
        await errorLogger.logError(error, {
          context: 'enhanced-signout-catch'
        });
        
        toast({
          variant: 'destructive',
          title: 'Sign out failed',
          description: error.message || 'An unexpected error occurred during sign out.',
        });
        
        return { error };
      } finally {
        setIsLoading(false);
      }
    });
  };

  return {
    signUp,
    signIn,
    signOut,
    isLoading
  };
}
