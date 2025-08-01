import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRetry } from '@/hooks/use-retry';

interface UpdateFeeAgreementParams {
  userId: string;
  isSigned: boolean;
  notes?: string;
}

interface SendFeeAgreementEmailParams {
  userId: string;
  userEmail: string;
  notes?: string;
}

interface UpdateEmailSentParams {
  userId: string;
  isSent: boolean;
  notes?: string;
}

export function useUpdateFeeAgreement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: UpdateFeeAgreementParams) => {
    const { data, error } = await supabase.rpc('update_fee_agreement_status', {
      target_user_id: params.userId,
      is_signed: params.isSigned,
      admin_notes: params.notes || null
    });

    if (error) throw error;
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, isSigned, notes }: UpdateFeeAgreementParams) => {
      return execute({ userId, isSigned, notes });
    },
    onMutate: async ({ userId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map((user: any) => 
            user.id === userId 
              ? { 
                  ...user, 
                  fee_agreement_signed: isSigned,
                  fee_agreement_signed_at: isSigned ? new Date().toISOString() : null
                } 
              : user
          )
        };
      });

      return { previousUsers };
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Fee Agreement Updated',
        description: `Fee agreement ${variables.isSigned ? 'marked as signed' : 'revoked'} successfully.`,
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      console.error('❌ Fee agreement update error:', error);
      
      // Rollback optimistic update
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update fee agreement status.',
      });
    }
  });
}

export function useUpdateFeeAgreementEmailSent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: UpdateEmailSentParams) => {
    const { data, error } = await supabase.rpc('update_fee_agreement_email_status', {
      target_user_id: params.userId,
      is_sent: params.isSent,
      admin_notes: params.notes || null
    });

    if (error) throw error;
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, isSent, notes }: UpdateEmailSentParams) => {
      return execute({ userId, isSent, notes });
    },
    onMutate: async ({ userId, isSent }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map((user: any) => 
            user.id === userId 
              ? { 
                  ...user, 
                  fee_agreement_email_sent: isSent,
                  fee_agreement_email_sent_at: isSent ? new Date().toISOString() : null
                } 
              : user
          )
        };
      });

      return { previousUsers };
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Email Status Updated',
        description: `Fee agreement email ${variables.isSent ? 'marked as sent' : 'marked as not sent'} successfully.`,
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      console.error('❌ Fee agreement email status update error:', error);
      
      // Rollback optimistic update
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update email sent status.',
      });
    }
  });
}

export function useLogFeeAgreementEmail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: SendFeeAgreementEmailParams) => {
    // Only log the email - actual sending happens in the component
    const { data, error } = await supabase.rpc('log_fee_agreement_email', {
      target_user_id: params.userId,
      recipient_email: params.userEmail,
      admin_notes: params.notes || null
    });

    if (error) throw error;
    
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, userEmail, notes }: SendFeeAgreementEmailParams) => {
      return execute({ userId, userEmail, notes });
    },
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previousUsers = queryClient.getQueryData(['admin-users']);

      queryClient.setQueryData(['admin-users'], (old: any) => {
        if (!old?.data) return old;
        
        return {
          ...old,
          data: old.data.map((user: any) => 
            user.id === userId 
              ? { 
                  ...user, 
                  fee_agreement_email_sent: true,
                  fee_agreement_email_sent_at: new Date().toISOString()
                } 
              : user
          )
        };
      });

      return { previousUsers };
    },
    onSuccess: () => {
      toast({
        title: 'Fee Agreement Logged',
        description: 'Fee agreement email logged successfully.',
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any, _, context) => {
      console.error('❌ Fee agreement email error:', error);
      
      // Rollback optimistic update
      if (context?.previousUsers) {
        queryClient.setQueryData(['admin-users'], context.previousUsers);
      }
      
      toast({
        variant: 'destructive',
        title: 'Logging Failed',
        description: error.message || 'Failed to log fee agreement email.',
      });
    }
  });
}