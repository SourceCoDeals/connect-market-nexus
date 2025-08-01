import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SendVerificationSuccessEmailParams {
  email: string;
  firstName?: string;
  lastName?: string;
}

export const useVerificationSuccessEmail = () => {
  const sendVerificationSuccessEmail = async ({
    email,
    firstName = '',
    lastName = ''
  }: SendVerificationSuccessEmailParams) => {
    try {
      // Sending verification success email
      
      const { data, error } = await supabase.functions.invoke('send-verification-success-email', {
        body: {
          email,
          firstName,
          lastName
        }
      });

      if (error) {
        console.error('Error sending verification success email:', error);
        throw error;
      }

      // Verification success email sent successfully
      return data;
    } catch (error: any) {
      console.error('Failed to send verification success email:', error);
      
      // Don't show toast errors for this as it's a background operation
      // The user shouldn't be interrupted by email sending failures
      
      throw error;
    }
  };

  return {
    sendVerificationSuccessEmail
  };
};