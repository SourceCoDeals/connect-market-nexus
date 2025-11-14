import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useUpdateListing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      listingId,
      updates,
    }: {
      listingId: string;
      updates: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listingId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-deals'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update listing: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}
