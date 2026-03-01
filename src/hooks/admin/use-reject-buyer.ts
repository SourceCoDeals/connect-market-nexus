import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RejectBuyerParams {
  listing_id: string;
  buyer_id: string;
  rejection_reason: string;
  rejection_notes?: string;
}

export function useRejectBuyer(listingId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listing_id,
      buyer_id,
      rejection_reason,
      rejection_notes,
    }: RejectBuyerParams) => {
      const { error } = await supabase
        .from('remarketing_scores')
        .update({
          is_disqualified: true,
          rejected_at: new Date().toISOString(),
          rejection_reason,
          rejection_notes: rejection_notes || null,
        })
        .eq('listing_id', listing_id)
        .eq('buyer_id', buyer_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['recommended-buyers', listingId],
      });
      toast.success('Buyer rejected');
    },
    onError: () => {
      toast.error('Failed to reject buyer');
    },
  });
}
