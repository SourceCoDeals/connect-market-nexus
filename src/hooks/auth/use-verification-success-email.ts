import { supabase } from "@/integrations/supabase/client";


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
    // Sending verification success email
    // Note: Don't show toast errors for this as it's a background operation
    // The user shouldn't be interrupted by email sending failures

    const { data, error } = await supabase.functions.invoke('send-verification-success-email', {
      body: {
        email,
        firstName,
        lastName
      }
    });

    if (error) {
      throw error;
    }

    // Verification success email sent successfully
    return data;
  };

  return {
    sendVerificationSuccessEmail
  };
};
