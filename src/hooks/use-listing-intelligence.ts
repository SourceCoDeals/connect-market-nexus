import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ListingPerformance {
  id: string;
  title: string;
  category: string;
  revenue: number;
  ebitda: number;
  created_at: string;
  views: number;
  saves: number;
  connections: number;
  conversion_rate: number;
  avg_view_duration: number;
  bounce_rate: number;
  time_to_first_save: number;
  time_to_first_connection: number;
  performance_score: number;
  performance_trend: 'improving' | 'declining' | 'stable';
  optimization_suggestions: string[];
}

export interface ListingJourney {
  listing_id: string;
  listing_title: string;
  user_journeys: {
    user_id: string;
    user_name: string;
    user_email: string;
    first_view: string;
    last_activity: string;
    total_views: number;
    time_spent: number;
    saved: boolean;
    connected: boolean;
    journey_stage: 'browser' | 'interested' | 'serious' | 'connected';
  }[];
}

export function useListingIntelligence(daysBack: number = 30) {
  return useQuery({
    queryKey: ['listing-intelligence', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get all listings with comprehensive analytics
      const { data: listings } = await supabase
        .from('listings')
        .select(`
          id, title, category, revenue, ebitda, created_at,
          listing_analytics!listing_analytics_listing_id_fkey(
            action_type, time_spent, created_at, user_id
          ),
          saved_listings!saved_listings_listing_id_fkey(
            created_at, user_id
          ),
          connection_requests!connection_requests_listing_id_fkey(
            created_at, user_id, status
          )
        `)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (!listings) return { listingPerformance: [], averageMetrics: null };

      const listingPerformance: ListingPerformance[] = [];
      const allMetrics: number[] = [];

      for (const listing of listings) {
        const views = listing.listing_analytics?.filter(a => a.action_type === 'view').length || 0;
        const saves = listing.saved_listings?.length || 0;
        const connections = listing.connection_requests?.filter(c => c.status === 'approved').length || 0;
        
        const totalTimeSpent = listing.listing_analytics
          ?.filter(a => a.time_spent)
          ?.reduce((sum, a) => sum + (a.time_spent || 0), 0) || 0;
        
        const avgViewDuration = views > 0 ? totalTimeSpent / views : 0;
        const conversionRate = views > 0 ? (connections / views) * 100 : 0;
        
        // Calculate time to first save and connection
        const firstSave = listing.saved_listings?.[0]?.created_at;
        const firstConnection = listing.connection_requests?.[0]?.created_at;
        const listingCreated = new Date(listing.created_at).getTime();
        
        const timeToFirstSave = firstSave ? 
          (new Date(firstSave).getTime() - listingCreated) / (1000 * 60 * 60 * 24) : 0;
        const timeToFirstConnection = firstConnection ?
          (new Date(firstConnection).getTime() - listingCreated) / (1000 * 60 * 60 * 24) : 0;

        // Calculate performance score (0-100)
        const viewScore = Math.min((views / 50) * 30, 30);
        const conversionScore = Math.min(conversionRate * 2, 40);
        const engagementScore = Math.min((avgViewDuration / 300) * 20, 20);
        const timeScore = saves > 0 ? Math.max(10 - (timeToFirstSave / 7), 0) : 0;
        
        const performanceScore = Math.round(viewScore + conversionScore + engagementScore + timeScore);
        allMetrics.push(performanceScore);

        // Generate optimization suggestions
        const suggestions: string[] = [];
        if (views < 20) suggestions.push("Improve listing visibility - consider better keywords");
        if (conversionRate < 2) suggestions.push("Enhance listing description to improve conversion");
        if (avgViewDuration < 120) suggestions.push("Add more engaging content to increase time spent");
        if (saves === 0 && views > 10) suggestions.push("Optimize pricing or business metrics");
        if (connections === 0 && saves > 3) suggestions.push("Follow up with interested users");

        listingPerformance.push({
          id: listing.id,
          title: listing.title,
          category: listing.category,
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          created_at: listing.created_at,
          views,
          saves,
          connections,
          conversion_rate: conversionRate,
          avg_view_duration: avgViewDuration,
          bounce_rate: views > 0 ? ((views - saves) / views) * 100 : 0,
          time_to_first_save: timeToFirstSave,
          time_to_first_connection: timeToFirstConnection,
          performance_score: performanceScore,
          performance_trend: 'stable', // Could be calculated based on week-over-week data
          optimization_suggestions: suggestions
        });
      }

      // Calculate average metrics for benchmarking
      const averageMetrics = allMetrics.length > 0 ? {
        avgViews: listingPerformance.reduce((sum, l) => sum + l.views, 0) / listingPerformance.length,
        avgConversionRate: listingPerformance.reduce((sum, l) => sum + l.conversion_rate, 0) / listingPerformance.length,
        avgPerformanceScore: allMetrics.reduce((sum, score) => sum + score, 0) / allMetrics.length,
        topPerformers: listingPerformance.filter(l => l.performance_score > 70).length,
        needsAttention: listingPerformance.filter(l => l.performance_score < 30).length
      } : null;

      return {
        listingPerformance: listingPerformance.sort((a, b) => b.performance_score - a.performance_score),
        averageMetrics
      };
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}

export function useListingJourneys(listingId?: string) {
  return useQuery({
    queryKey: ['listing-journeys', listingId],
    queryFn: async (): Promise<ListingJourney[]> => {
      const query = supabase
        .from('listings')
        .select(`
          id, title,
          listing_analytics!listing_analytics_listing_id_fkey(
            user_id, created_at, time_spent, action_type
          ),
          saved_listings!saved_listings_listing_id_fkey(
            user_id, created_at
          ),
          connection_requests!connection_requests_listing_id_fkey(
            user_id, created_at, status
          )
        `)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (listingId) {
        query.eq('id', listingId);
      }

      const { data: listings } = await query;
      if (!listings) return [];

      const journeys: ListingJourney[] = [];

      for (const listing of listings) {
        const userMap = new Map();

        // Process all user interactions
        listing.listing_analytics?.forEach(analytics => {
          if (!analytics.user_id) return;
          
          if (!userMap.has(analytics.user_id)) {
            userMap.set(analytics.user_id, {
              user_id: analytics.user_id,
              views: [],
              total_time: 0,
              saved: false,
              connected: false
            });
          }
          
          const userData = userMap.get(analytics.user_id);
          userData.views.push(analytics.created_at);
          userData.total_time += analytics.time_spent || 0;
        });

        // Process saves
        listing.saved_listings?.forEach(save => {
          if (userMap.has(save.user_id)) {
            userMap.get(save.user_id).saved = true;
          }
        });

        // Process connections
        listing.connection_requests?.forEach(connection => {
          if (userMap.has(connection.user_id)) {
            userMap.get(connection.user_id).connected = connection.status === 'approved';
          }
        });

        // Get user profiles
        const userIds = Array.from(userMap.keys());
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name')
            .in('id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          const userJourneys = Array.from(userMap.entries()).map(([userId, userData]) => {
            const profile = profileMap.get(userId);
            if (!profile) return null;

            const sortedViews = userData.views.sort();
            let journeyStage: 'browser' | 'interested' | 'serious' | 'connected' = 'browser';
            
            if (userData.connected) journeyStage = 'connected';
            else if (userData.saved && userData.views.length > 2) journeyStage = 'serious';
            else if (userData.saved || userData.views.length > 1) journeyStage = 'interested';

            return {
              user_id: userId,
              user_name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
              user_email: profile.email,
              first_view: sortedViews[0],
              last_activity: sortedViews[sortedViews.length - 1],
              total_views: userData.views.length,
              time_spent: userData.total_time,
              saved: userData.saved,
              connected: userData.connected,
              journey_stage: journeyStage
            };
          }).filter(Boolean);

          journeys.push({
            listing_id: listing.id,
            listing_title: listing.title,
            user_journeys: userJourneys as any[]
          });
        }
      }

      return journeys;
    },
    enabled: true,
    refetchInterval: 300000,
  });
}