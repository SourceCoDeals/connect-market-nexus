import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketplaceAnalytics {
  total_users: number;
  new_users: number;
  active_users: number;
  avg_session_duration: number;
  bounce_rate: number;
  page_views: number;
  top_pages: Array<{
    page: string;
    views: number;
    unique_views: number;
  }>;
  user_funnel: Array<{
    step: string;
    count: number;
    conversion_rate: number;
  }>;
  listing_performance: {
    total_views: number;
    total_saves: number;
    total_connections: number;
    avg_time_spent: number;
    top_listings: Array<{
      listing_id: string;
      views: number;
    }>;
  };
  search_insights: {
    total_searches: number;
    avg_results: number;
    no_results_rate: number;
    top_queries: Array<{
      query: string;
      count: number;
    }>;
  };
  user_segments: {
    high_engagement: number;
    medium_engagement: number;
    low_engagement: number;
    at_risk: number;
  };
  conversion_metrics: {
    signup_to_profile_completion: number;
    view_to_save_rate: number;
    view_to_connection_rate: number;
  };
}

export function useMarketplaceAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['marketplace-analytics', daysBack],
    queryFn: async (): Promise<MarketplaceAnalytics> => {
      const { data, error } = await supabase.rpc('get_simple_marketplace_analytics', {
        days_back: daysBack
      });

      if (error) {
        console.error('Error fetching marketplace analytics:', error);
        throw error;
      }

      // Return basic analytics from simple function
      const simpleData = Array.isArray(data) ? data[0] : data;
      if (!simpleData) {
        // Return empty analytics structure
        return {
          total_users: 0,
          new_users: 0,
          active_users: 0,
          avg_session_duration: 0,
          bounce_rate: 0,
          page_views: 0,
          top_pages: [],
          user_funnel: [],
          listing_performance: {
            total_views: 0,
            total_saves: 0,
            total_connections: 0,
            avg_time_spent: 0,
            top_listings: []
          },
          search_insights: {
            total_searches: 0,
            avg_results: 0,
            no_results_rate: 0,
            top_queries: []
          },
          user_segments: {
            high_engagement: 0,
            medium_engagement: 0,
            low_engagement: 0,
            at_risk: 0
          },
          conversion_metrics: {
            signup_to_profile_completion: 0,
            view_to_save_rate: 0,
            view_to_connection_rate: 0
          }
        };
      }

      // Map simple analytics to complex interface structure
      return {
        total_users: Number(simpleData.total_users) || 0,
        new_users: Number(simpleData.new_users) || 0,
        active_users: Number(simpleData.active_sessions) || 0, // Map active_sessions to active_users
        avg_session_duration: 15, // Mock value
        bounce_rate: 35, // Mock value
        page_views: Number(simpleData.total_page_views) || 0,
        top_pages: [], // Empty for now
        user_funnel: [], // Empty for now
        listing_performance: {
          total_views: 0, // Will be populated when listing analytics work
          total_saves: 0,
          total_connections: Number(simpleData.pending_connections) || 0,
          avg_time_spent: 0,
          top_listings: []
        },
        search_insights: {
          total_searches: 0,
          avg_results: 0,
          no_results_rate: 0,
          top_queries: []
        },
        user_segments: {
          high_engagement: Math.floor((Number(simpleData.total_users) || 0) * 0.2), // Mock 20% high engagement
          medium_engagement: Math.floor((Number(simpleData.total_users) || 0) * 0.5), // Mock 50% medium
          low_engagement: Math.floor((Number(simpleData.total_users) || 0) * 0.3), // Mock 30% low
          at_risk: Math.floor((Number(simpleData.total_users) || 0) * 0.1) // Mock 10% at risk
        },
        conversion_metrics: {
          signup_to_profile_completion: 85, // Mock value
          view_to_save_rate: 12, // Mock value
          view_to_connection_rate: 8 // Mock value
        }
      };
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });
}

export function useDailyMetrics(days: number = 30) {
  return useQuery({
    queryKey: ['daily-metrics', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching daily metrics:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

export function useUserEngagementScores() {
  return useQuery({
    queryKey: ['user-engagement-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_scores')
        .select(`
          *,
          profiles:user_id(first_name, last_name, email)
        `)
        .order('score', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching engagement scores:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
  });
}

export function useListingAnalytics(listingId?: string, daysBack: number = 30) {
  return useQuery({
    queryKey: ['listing-analytics', listingId, daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      let query = supabase
        .from('listing_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (listingId) {
        query = query.eq('listing_id', listingId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching listing analytics:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!listingId || daysBack > 0,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useSearchAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['search-analytics', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('search_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching search analytics:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRegistrationFunnelAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['registration-funnel-analytics', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('registration_funnel')
        .select('*')
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching registration funnel analytics:', error);
        throw error;
      }

      return data || [];
    },
    refetchInterval: 10 * 60 * 1000,
  });
}