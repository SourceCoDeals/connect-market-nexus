import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UpdateMessageParams {
  requestId: string;
  message: string;
}

export const useUpdateConnectionMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, message }: UpdateMessageParams) => {
      const { data, error } = await supabase
        .from('connection_requests')
        .update({ user_message: message })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure data is fresh everywhere
      queryClient.invalidateQueries({ 
        queryKey: ['user-connection-requests'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['connection-requests'] // Admin queries
      });
      queryClient.invalidateQueries({ 
        queryKey: ['user-connection-requests'] // Admin user-specific queries
      });
    },
  });
};
