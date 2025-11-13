import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch deals assigned to the current admin
 * Useful for "My Deals" dashboard widget
 */
export function useMyDeals() {
  return useQuery({
    queryKey: ['my-deals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          stage:deal_stages(name, color),
          listing:listings(title, revenue, ebitda)
        `)
        .eq('assigned_to', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to get deal statistics for the current admin
 */
export function useMyDealStats() {
  return useQuery({
    queryKey: ['my-deal-stats'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: deals, error } = await supabase
        .from('deals')
        .select('id, stage_id, value, followed_up, stage_entered_at')
        .eq('assigned_to', user.id)
        .is('deleted_at', null);

      if (error) throw error;

      const totalDeals = deals?.length || 0;
      const totalValue = deals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0;
      const needsFollowUp = deals?.filter(d => !d.followed_up).length || 0;
      
      // Deals that haven't moved in 7+ days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const stale = deals?.filter(d => 
        new Date(d.stage_entered_at) < weekAgo
      ).length || 0;

      return {
        totalDeals,
        totalValue,
        needsFollowUp,
        staleDeals: stale,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
