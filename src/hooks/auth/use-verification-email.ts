import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useVerificationEmail() {
  const [isSending, setIsSending] = useState(false);

  const sendVerificationEmail = async (email: string, redirectTo?: string) => {
    setIsSending(true);
    
    try {
      console.log('🔄 Sending verification email to:', email);
      
      const redirectUrl = redirectTo || `${window.location.origin}/verify-email-handler`;
      
      // First try Supabase's built-in verification email
      const { error: supabaseError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (supabaseError) {
        console.warn('⚠️ Supabase verification email failed:', supabaseError.message);
        
        // Fallback to custom edge function
        console.log('📧 Trying custom verification email as fallback');
        const { error: customError } = await supabase.functions.invoke('send-verification-email', {
          body: { 
            email,
            token: 'verification-request',
            redirectTo: redirectUrl
          }
        });
        
        if (customError) {
          console.error('❌ Custom verification email also failed:', customError);
          throw new Error('Failed to send verification email. Please try again.');
        }
        
        console.log('✅ Custom verification email sent successfully');
      } else {
        console.log('✅ Supabase verification email sent successfully');
      }
      
      toast({
        title: 'Verification email sent',
        description: 'Please check your email and click the verification link.',
      });
      
      return { success: true, error: null };
    } catch (error: any) {
      console.error('💥 Failed to send verification email:', error);
      
      toast({
        variant: 'destructive',
        title: 'Failed to send email',
        description: error.message || 'Please try again later.',
      });
      
      return { success: false, error };
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendVerificationEmail,
    isSending
  };
}