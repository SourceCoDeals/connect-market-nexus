import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DocuSealStatus = 'not_sent' | 'sent' | 'viewed' | 'signed' | 'declined';

/**
 * Hook to create a DocuSeal signing submission (NDA or Fee Agreement).
 * Calls the create-docuseal-submission edge function.
 */
export function useCreateDocuSealSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      firmId,
      documentType,
      buyerEmail,
      buyerName,
      sendEmail,
    }: {
      firmId: string;
      documentType: 'nda' | 'fee_agreement';
      buyerEmail: string;
      buyerName: string;
      sendEmail: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-docuseal-submission', {
        body: {
          firm_id: firmId,
          document_type: documentType,
          buyer_email: buyerEmail,
          buyer_name: buyerName,
          send_email: sendEmail,
        },
      });

      if (error) throw error;
      return data as { embed_src: string; submission_id: string; submitter_id: string; status: string };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      const docType = variables.documentType === 'nda' ? 'NDA' : 'Fee Agreement';
      const method = variables.sendEmail ? 'sent via email' : 'ready for signing';
      toast({
        title: `${docType} ${method}`,
        description: `Signing request ${method} to ${variables.buyerEmail}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create signing request',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to trigger auto-create-firm-on-approval edge function.
 */
export function useAutoCreateFirmOnApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke('auto-create-firm-on-approval', {
        body: { user_id: userId },
      });

      if (error) throw error;
      return data as {
        firm_id: string;
        firm_created: boolean;
        member_linked: boolean;
        nda_submission_prepared: boolean;
        embed_src: string | null;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['firm-members'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

/**
 * Hook to fetch NDA signing status for the current buyer.
 * Used by PendingApproval page and NDA gate modal.
 */
export function useBuyerNdaStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['buyer-nda-status', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Get the buyer's firm membership
      const { data: membership } = await supabase
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        return { hasFirm: false, ndaSigned: false, embedSrc: null, firmId: null };
      }

      // Get firm agreement status
      const { data: firm } = await supabase
        .from('firm_agreements')
        .select('id, nda_signed, nda_docuseal_status, nda_docuseal_submission_id')
        .eq('id', membership.firm_id)
        .single();

      if (!firm) {
        return { hasFirm: false, ndaSigned: false, embedSrc: null, firmId: null };
      }

      return {
        hasFirm: true,
        ndaSigned: firm.nda_signed,
        docusealStatus: firm.nda_docuseal_status,
        hasSubmission: !!firm.nda_docuseal_submission_id,
        firmId: firm.id,
        // embed_src needs to be fetched from DocuSeal API via edge function
        // The frontend will call create-docuseal-submission if needed
        embedSrc: null as string | null,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
