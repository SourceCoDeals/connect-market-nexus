import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DealContact {
  id: string;
  deal_id: string;
  contact_type: 'email' | 'phone' | 'meeting' | 'note';
  admin_id: string;
  contact_details: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useLogDealContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      dealId,
      contactType,
      details = {}
    }: {
      dealId: string;
      contactType: 'email' | 'phone' | 'meeting' | 'note';
      details?: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from('deal_contacts')
        .insert({
          deal_id: dealId,
          contact_type: contactType,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          contact_details: details
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Contact Logged',
        description: 'Contact activity has been recorded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to log contact: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
}