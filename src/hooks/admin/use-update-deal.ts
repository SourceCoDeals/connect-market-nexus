import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      updates,
    }: {
      dealId: string;
      updates: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deals'] });
      queryClient.invalidateQueries({ queryKey: ['my-deal-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update deal: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
