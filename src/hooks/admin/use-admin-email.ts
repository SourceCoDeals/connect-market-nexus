
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send approval email');
      }

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send rejection email');
      }

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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'connection_approved',
          email: request.user.email,
          firstName: request.user.first_name,
          data: {
            listingName: request.listing?.title || 'Business listing',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send connection approval email');
      }

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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'connection_rejected',
          email: request.user.email,
          firstName: request.user.first_name,
          data: {
            listingName: request.listing?.title || 'Business listing',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send connection rejection email');
      }

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
