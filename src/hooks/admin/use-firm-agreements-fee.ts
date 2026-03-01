/**
 * Fee Agreement-related hooks for Firm Agreements
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { FirmAgreement } from './use-firm-agreements-types';

export function useUpdateFirmFeeAgreement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      firmId,
      isSigned,
      signedByUserId,
      signedByName: _signedByName,
    }: {
      firmId: string;
      isSigned: boolean;
      signedByUserId?: string | null;
      signedByName?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('update_fee_agreement_firm_status', {
        p_firm_id: firmId,
        p_is_signed: isSigned,
        p_signed_by_user_id: signedByUserId ?? undefined,
        p_signed_at: (isSigned ? new Date().toISOString() : null) ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async ({ firmId, isSigned }) => {
      await queryClient.cancelQueries({ queryKey: ['firm-agreements'] });

      const previousData = queryClient.getQueryData(['firm-agreements']);

      queryClient.setQueryData<FirmAgreement[] | undefined>(['firm-agreements'], (old) => {
        if (!old) return old;
        return old.map((firm) =>
          firm.id === firmId
            ? {
                ...firm,
                fee_agreement_signed: isSigned,
                fee_agreement_signed_at: isSigned ? new Date().toISOString() : null,
              }
            : firm
        );
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['firm-members'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'], refetchType: 'active' });

      toast({
        title: 'Success',
        description: 'Fee agreement status updated for firm',
      });
    },
    onError: (error: Error, _variables: unknown, context: { previousData?: unknown } | undefined) => {
      if (context?.previousData) {
        queryClient.setQueryData(['firm-agreements'], context.previousData);
      }
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
