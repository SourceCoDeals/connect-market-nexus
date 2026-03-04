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
        .from('admin_view_state')
        .upsert(
          {
            admin_id: user.id,
            view_type: 'connection_requests',
            last_viewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'admin_id,view_type',
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
