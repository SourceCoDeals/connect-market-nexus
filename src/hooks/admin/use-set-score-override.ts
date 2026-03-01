import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SetScoreOverrideParams {
  buyer_id: string;
  listing_id: string;
  score: number;
}

export function useSetScoreOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ buyer_id, listing_id, score }: SetScoreOverrideParams) => {
      const { error } = await supabase
        .from('remarketing_scores')
        .update({ human_override_score: score })
        .eq('buyer_id', buyer_id)
        .eq('listing_id', listing_id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['recommended-buyers', variables.listing_id],
      });
      toast.success('Score override saved');
    },
    onError: () => {
      toast.error('Failed to save score override');
    },
  });
}
