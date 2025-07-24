
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useVerificationEmail() {
  const [isSending, setIsSending] = useState(false);

  const sendVerificationEmail = async (email: string, redirectTo?: string) => {
    setIsSending(true);
    
    try {
      console.log('🔄 Sending verification email to:', email);
      
      // Always use production domain - direct to pending approval
      const redirectUrl = `https://marketplace.sourcecodeals.com/pending-approval`;
      
      // Use only Supabase's built-in verification email with proper redirect URL
      const { error: supabaseError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (supabaseError) {
        console.error('❌ Failed to send verification email:', supabaseError.message);
        throw new Error('Failed to send verification email. Please try again.');
      }
      
      console.log('✅ Verification email sent successfully');
      
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
