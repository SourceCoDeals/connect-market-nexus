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

export const useUpdateFeeAgreement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isSigned, notes }: UpdateFeeAgreementParams) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          fee_agreement_signed: isSigned,
          fee_agreement_signed_at: isSigned ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

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
      const { data, error } = await supabase
        .from('profiles')
        .update({
          fee_agreement_email_sent: isSent,
          fee_agreement_email_sent_at: isSent ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

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