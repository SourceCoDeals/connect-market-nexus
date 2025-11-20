import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export function useMarkConnectionRequestsViewed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('admin_connection_requests_views')
        .upsert(
          {
            admin_id: user.id,
            last_viewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'admin_id',
          }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate the unviewed count query
      queryClient.invalidateQueries({ queryKey: ['unviewed-connection-requests-count'] });
    },
  });

  return {
    markAsViewed: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
