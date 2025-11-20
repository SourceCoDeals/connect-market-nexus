import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useUnviewedDealSourcingCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['unviewed-deal-sourcing-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Get admin's last viewed timestamp
      const { data: viewData } = await supabase
        .from('admin_deal_sourcing_views')
        .select('last_viewed_at')
        .eq('admin_id', user.id)
        .single();

      const lastViewed = viewData?.last_viewed_at || '1970-01-01';

      // Count requests created after last viewed
      const { count, error } = await supabase
        .from('deal_sourcing_requests')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastViewed);

      if (error) throw error;
      return count || 0;
    },
  });

  // Real-time subscription for new requests
  useEffect(() => {
    const channel = supabase
      .channel('deal-sourcing-new-requests')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'deal_sourcing_requests',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['unviewed-deal-sourcing-count'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    unviewedCount: query.data || 0,
    isLoading: query.isLoading,
  };
}
