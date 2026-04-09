import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { markAdminViewAsViewed } from '@/lib/data-access';

export function useMarkMatchToolLeadsViewed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const result = await markAdminViewAsViewed(user.id, 'match_tool_leads');
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unviewed-match-tool-leads-count'] });
    },
  });

  return {
    markAsViewed: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
