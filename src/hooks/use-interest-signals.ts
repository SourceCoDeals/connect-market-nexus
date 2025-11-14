import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInterestSignal(listingId: string) {
  return useQuery({
    queryKey: ['interest-signal', listingId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hasExpressed: false, count: 0 };

      const { data: userSignal } = await supabase
        .from('interest_signals')
        .select('*')
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
        .single();

      const { count } = await supabase
        .from('interest_signals')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId);

      return {
        hasExpressed: !!userSignal,
        count: count || 0,
      };
    },
  });
}

export function useExpressInterest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listingId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('interest_signals')
        .insert({
          listing_id: listingId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('You have already expressed interest');
        }
        throw error;
      }

      return data;
    },
    onSuccess: (_, listingId) => {
      queryClient.invalidateQueries({ queryKey: ['interest-signal', listingId] });
      toast({
        title: 'Interest noted',
        description: 'We\'ll notify the seller of your interest',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to express interest',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useWithdrawInterest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listingId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('interest_signals')
        .delete()
        .eq('listing_id', listingId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, listingId) => {
      queryClient.invalidateQueries({ queryKey: ['interest-signal', listingId] });
      toast({
        title: 'Interest withdrawn',
      });
    },
  });
}
