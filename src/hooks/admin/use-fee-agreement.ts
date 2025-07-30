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
    onSuccess: (_, variables) => {
      toast({
        title: 'Fee Agreement Updated',
        description: `Fee agreement ${variables.isSigned ? 'marked as signed' : 'revoked'} successfully.`,
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      console.error('❌ Fee agreement update error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update fee agreement status.',
      });
    }
  });
}

export function useLogFeeAgreementEmail() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute } = useRetry(async (params: SendFeeAgreementEmailParams) => {
    // First log the email
    const { data, error } = await supabase.rpc('log_fee_agreement_email', {
      target_user_id: params.userId,
      recipient_email: params.userEmail,
      admin_notes: params.notes || null
    });

    if (error) throw error;

    // Then send the actual email via edge function
    const { error: emailError } = await supabase.functions.invoke('send-fee-agreement-email', {
      body: {
        userId: params.userId,
        userEmail: params.userEmail,
        adminNotes: params.notes
      }
    });

    if (emailError) throw emailError;
    
    return data;
  });

  return useMutation({
    mutationFn: async ({ userId, userEmail, notes }: SendFeeAgreementEmailParams) => {
      return execute({ userId, userEmail, notes });
    },
    onSuccess: () => {
      toast({
        title: 'Fee Agreement Email Sent',
        description: 'Fee agreement email sent successfully.',
      });
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      console.error('❌ Fee agreement email error:', error);
      toast({
        variant: 'destructive',
        title: 'Email Failed',
        description: error.message || 'Failed to send fee agreement email.',
      });
    }
  });
}