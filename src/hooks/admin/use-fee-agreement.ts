import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UpdateFeeAgreementParams {
  userId: string;
  isSigned: boolean;
  notes?: string;
}

interface UpdateFeeAgreementEmailParams {
  userId: string;
  isSent: boolean;
  notes?: string;
}

interface LogFeeAgreementEmailParams {
  userId: string;
  userEmail: string;
  notes?: string;
}

export const useUpdateFeeAgreement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSigned, notes }: UpdateFeeAgreementParams) => {
      const { data, error } = await supabase.rpc('update_fee_agreement_status', {
        target_user_id: userId,
        is_signed: isSigned,
        admin_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ userId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Update admin users
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                fee_agreement_signed: isSigned,
                fee_agreement_signed_at: isSigned ? new Date().toISOString() : null 
              }
            : user
        );
      });

      // Update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  fee_agreement_signed: isSigned,
                  fee_agreement_signed_at: isSigned ? new Date().toISOString() : null 
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      // Invalidate queries to get fresh data from backend
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Fee agreement status updated",
        description: "The fee agreement status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update fee agreement status",
      });
    },
  });
};

export const useUpdateFeeAgreementEmailSent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSent, notes }: UpdateFeeAgreementEmailParams) => {
      const { data, error } = await supabase.rpc('update_fee_agreement_email_status', {
        target_user_id: userId,
        is_sent: isSent,
        admin_notes: notes
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ userId, isSent }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Update admin users
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                fee_agreement_email_sent: isSent,
                fee_agreement_email_sent_at: isSent ? new Date().toISOString() : null 
              }
            : user
        );
      });

      // Update connection requests
      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  fee_agreement_email_sent: isSent,
                  fee_agreement_email_sent_at: isSent ? new Date().toISOString() : null 
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      // Invalidate queries to get fresh data from backend
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      toast({
        title: "Fee agreement email status updated",
        description: "The fee agreement email status has been successfully updated.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update fee agreement email status",
      });
    },
  });
};

export const useLogFeeAgreementEmail = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userEmail, notes }: LogFeeAgreementEmailParams) => {
      console.log('🚀 Sending fee agreement email with data:', {
        userId,
        userEmail
      });

      // Send email via edge function (which also handles database logging)
      const { data, error } = await supabase.functions.invoke('send-fee-agreement-email', {
        body: {
          userId,
          userEmail,
          useTemplate: true,
          adminEmail: 'adam.haile@sourcecodeals.com',
          adminName: 'Adam Haile'
        }
      });

      if (error) {
        console.error('❌ Fee agreement email sending failed:', error);
        throw error;
      }

      // The edge function handles database logging, so we don't need a separate RPC call
      console.log('✅ Fee agreement email sent successfully:', data);
      return data;
    },
    onMutate: async ({ userId }) => {
      // Optimistic updates for immediate UI feedback (like NDA)
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      await queryClient.cancelQueries({ queryKey: ['connection-requests'] });

      const previousUsers = queryClient.getQueryData(['admin-users']);
      const previousRequests = queryClient.getQueryData(['connection-requests']);

      // Optimistically update BOTH email sent AND signed status immediately
      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old) return old;
        return old.map((user: any) => 
          user.id === userId 
            ? { 
                ...user, 
                fee_agreement_email_sent: true,
                fee_agreement_email_sent_at: new Date().toISOString(),
                fee_agreement_signed: true,
                fee_agreement_signed_at: new Date().toISOString()
              }
            : user
        );
      });

      queryClient.setQueryData(['connection-requests'], (old: any) => {
        if (!old) return old;
        return old.map((request: any) => 
          request.user?.id === userId 
            ? { 
                ...request, 
                user: {
                  ...request.user,
                  fee_agreement_email_sent: true,
                  fee_agreement_email_sent_at: new Date().toISOString(),
                  fee_agreement_signed: true,
                  fee_agreement_signed_at: new Date().toISOString()
                }
              }
            : request
        );
      });

      return { previousUsers, previousRequests };
    },
    onSuccess: () => {
      // Don't invalidate immediately - let optimistic updates show, database will sync later
      toast({
        title: "Fee agreement email sent successfully",
        description: "The fee agreement email has been sent and logged.",
      });
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['admin-users'], context?.previousUsers);
      queryClient.setQueryData(['connection-requests'], context?.previousRequests);
      toast({
        variant: "destructive",
        title: "Email logging failed",
        description: "Could not log the fee agreement email",
      });
    },
  });
};