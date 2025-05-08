
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { AdminConnectionRequest } from '@/types/admin';

/**
 * Hook for sending admin emails
 */
export function useAdminEmail() {
  const { toast } = useToast();

  /**
   * Send approval email to user
   */
  const sendUserApprovalEmail = async (user: User) => {
    try {
      console.log(`Sending approval email to ${user.email}`);
      
      // Call the edge function to send email
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'approval',
          email: user.email,
          firstName: user.first_name,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API response:', errorText);
        throw new Error(`Failed to send approval email: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Email sent successfully:", data);
      return data;
    } catch (error: any) {
      console.error('Error sending approval email:', error);
      toast({
        variant: 'destructive',
        title: 'Email Error',
        description: error.message || 'Failed to send approval email',
      });
      throw error;
    }
  };

  /**
   * Send rejection email to user
   */
  const sendUserRejectionEmail = async (user: User, reason?: string) => {
    try {
      console.log(`Sending rejection email to ${user.email}`);
      
      // Call the edge function to send email
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'rejection',
          email: user.email,
          firstName: user.first_name,
          data: {
            rejectionReason: reason || 'Your application did not meet our current criteria.',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API response:', errorText);
        throw new Error(`Failed to send rejection email: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Email sent successfully:", data);
      return data;
    } catch (error: any) {
      console.error('Error sending rejection email:', error);
      toast({
        variant: 'destructive',
        title: 'Email Error',
        description: error.message || 'Failed to send rejection email',
      });
      throw error;
    }
  };

  /**
   * Send connection approval email to user
   */
  const sendConnectionApprovalEmail = async (request: AdminConnectionRequest) => {
    if (!request.user) {
      console.error('Cannot send approval email: User information missing');
      return;
    }
    
    try {
      console.log(`Sending connection approval email to ${request.user.email}`);
      
      // Call the edge function to send connection notification
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-connection-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'approved',
          userId: request.user.id,
          userEmail: request.user.email,
          firstName: request.user.first_name,
          listingName: request.listing?.title || 'Business listing',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API response:', errorText);
        throw new Error(`Failed to send connection approval email: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Connection approval email sent successfully:", data);
      return data;
    } catch (error: any) {
      console.error('Error sending connection approval email:', error);
      toast({
        variant: 'destructive',
        title: 'Email Error',
        description: error.message || 'Failed to send connection approval email',
      });
      throw error;
    }
  };

  /**
   * Send connection rejection email to user
   */
  const sendConnectionRejectionEmail = async (request: AdminConnectionRequest) => {
    if (!request.user) {
      console.error('Cannot send rejection email: User information missing');
      return;
    }
    
    try {
      console.log(`Sending connection rejection email to ${request.user.email}`);
      
      // Call the edge function to send connection notification
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-connection-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'rejected',
          userId: request.user.id,
          userEmail: request.user.email,
          firstName: request.user.first_name,
          listingName: request.listing?.title || 'Business listing',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API response:', errorText);
        throw new Error(`Failed to send connection rejection email: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Connection rejection email sent successfully:", data);
      return data;
    } catch (error: any) {
      console.error('Error sending connection rejection email:', error);
      toast({
        variant: 'destructive',
        title: 'Email Error',
        description: error.message || 'Failed to send connection rejection email',
      });
      throw error;
    }
  };

  return {
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
  };
}
