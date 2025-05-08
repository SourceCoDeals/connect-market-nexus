
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User } from '@/types';
import { AdminConnectionRequest } from '@/types/admin';

type EmailType = 
  | "account_approved"
  | "account_rejected"
  | "connection_approved"
  | "connection_rejected";

interface SendEmailParams {
  type: EmailType;
  recipientEmail: string;
  recipientName: string;
  data?: {
    listingName?: string;
    rejectionReason?: string;
    verificationLink?: string;
  };
}

/**
 * Hook for sending admin notification emails
 */
export function useAdminEmail() {
  const useSendEmail = () => {
    return useMutation({
      mutationFn: async (params: SendEmailParams) => {
        const response = await fetch(`${window.location.origin}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify(params),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error sending email');
        }
        
        return await response.json();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Error sending email',
          description: error.message,
        });
      },
    });
  };

  const sendUserApprovalEmail = (user: User) => {
    return useSendEmail().mutateAsync({
      type: 'account_approved',
      recipientEmail: user.email,
      recipientName: `${user.first_name} ${user.last_name}`,
    });
  };

  const sendUserRejectionEmail = (user: User, reason?: string) => {
    return useSendEmail().mutateAsync({
      type: 'account_rejected',
      recipientEmail: user.email,
      recipientName: `${user.first_name} ${user.last_name}`,
      data: {
        rejectionReason: reason,
      },
    });
  };

  const sendConnectionApprovalEmail = (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      toast({
        variant: 'destructive',
        title: 'Error sending email',
        description: 'Missing user or listing information',
      });
      return Promise.reject('Missing user or listing information');
    }
    
    return useSendEmail().mutateAsync({
      type: 'connection_approved',
      recipientEmail: request.user.email,
      recipientName: `${request.user.first_name} ${request.user.last_name}`,
      data: {
        listingName: request.listing.title,
      },
    });
  };

  const sendConnectionRejectionEmail = (request: AdminConnectionRequest) => {
    if (!request.user || !request.listing) {
      toast({
        variant: 'destructive',
        title: 'Error sending email',
        description: 'Missing user or listing information',
      });
      return Promise.reject('Missing user or listing information');
    }
    
    return useSendEmail().mutateAsync({
      type: 'connection_rejected',
      recipientEmail: request.user.email,
      recipientName: `${request.user.first_name} ${request.user.last_name}`,
      data: {
        listingName: request.listing.title,
      },
    });
  };

  return {
    useSendEmail,
    sendUserApprovalEmail,
    sendUserRejectionEmail,
    sendConnectionApprovalEmail,
    sendConnectionRejectionEmail,
  };
}
