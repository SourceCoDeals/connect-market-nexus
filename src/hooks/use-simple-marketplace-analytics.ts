import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SimpleMarketplaceAnalytics {
  total_users: number;
  new_users: number;
  active_sessions: number;
  total_page_views: number;
  total_listings: number;
  pending_connections: number;
  session_count: number;
}

export function useSimpleMarketplaceAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['simple-marketplace-analytics', daysBack],
    queryFn: async (): Promise<SimpleMarketplaceAnalytics> => {
      const { data, error } = await supabase.rpc('get_simple_marketplace_analytics', {
        days_back: daysBack
      });

      if (error) {
        console.error('Error fetching simple analytics:', error);
        throw error;
      }

      return data?.[0] || {
        total_users: 0,
        new_users: 0,
        active_sessions: 0,
        total_page_views: 0,
        total_listings: 0,
        pending_connections: 0,
        session_count: 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Simple table-based analytics that actually work
export function useAnalyticsHealthCheck() {
  return useQuery({
    queryKey: ['analytics-health'],
    queryFn: async () => {
      const checks = await Promise.allSettled([
        supabase.from('user_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('page_views').select('*', { count: 'exact', head: true }),
        supabase.from('listing_analytics').select('*', { count: 'exact', head: true }),
        supabase.from('user_events').select('*', { count: 'exact', head: true }),
        supabase.from('search_analytics').select('*', { count: 'exact', head: true })
      ]);

      return {
        user_sessions: checks[0].status === 'fulfilled' ? (checks[0].value.count || 0) : 0,
        page_views: checks[1].status === 'fulfilled' ? (checks[1].value.count || 0) : 0,
        listing_analytics: checks[2].status === 'fulfilled' ? (checks[2].value.count || 0) : 0,
        user_events: checks[3].status === 'fulfilled' ? (checks[3].value.count || 0) : 0,
        search_analytics: checks[4].status === 'fulfilled' ? (checks[4].value.count || 0) : 0,
      };
    },
    refetchInterval: 10000,
  });
}