import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export function useUnviewedMatchToolLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['unviewed-match-tool-leads-count'],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get admin's last viewed timestamp
      const { data: viewData, error: viewDataError } = await supabase
        .from('admin_view_state')
        .select('last_viewed_at')
        .eq('admin_id', user.id)
        .eq('view_type', 'match_tool_leads')
        .maybeSingle();
      if (viewDataError) throw viewDataError;

      const lastViewed = viewData?.last_viewed_at;

      let queryBuilder = supabase
        .from('match_tool_leads')
        .select('id', { count: 'exact', head: true });

      if (lastViewed) {
        queryBuilder = queryBuilder.gt('created_at', lastViewed);
      }

      const { count, error } = await queryBuilder;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Real-time subscription for new leads
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('match-tool-leads-new')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_tool_leads',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unviewed-match-tool-leads-count'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    unviewedCount: query.data || 0,
    isLoading: query.isLoading,
  };
}
