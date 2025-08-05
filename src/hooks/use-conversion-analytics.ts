import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ConversionFunnelData {
  step: string;
  users: number;
  dropoff: number;
}

interface ListingConversionData {
  listing_id: string;
  listing_title: string;
  views: number;
  saves: number;
  connections: number;
  conversion_rate: number;
  avg_view_duration: number;
  revenue: number;
}

export function useConversionAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['conversion-analytics', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get conversion funnel data
      const funnelData = await Promise.all([
        // Step 1: Page views
        supabase
          .from('page_views')
          .select('user_id', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .not('user_id', 'is', null),
        
        // Step 2: Listing views
        supabase
          .from('listing_analytics')
          .select('user_id', { count: 'exact' })
          .eq('action_type', 'view')
          .gte('created_at', startDate.toISOString())
          .not('user_id', 'is', null),
        
        // Step 3: Listing saves
        supabase
          .from('saved_listings')
          .select('user_id', { count: 'exact' })
          .gte('created_at', startDate.toISOString()),
        
        // Step 4: Connection requests
        supabase
          .from('connection_requests')
          .select('user_id', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
      ]);

      const pageViews = funnelData[0].count || 0;
      const listingViews = funnelData[1].count || 0;
      const saves = funnelData[2].count || 0;
      const connections = funnelData[3].count || 0;

      const conversionFunnel: ConversionFunnelData[] = [
        { step: 'Page Views', users: pageViews, dropoff: 0 },
        { step: 'Listing Views', users: listingViews, dropoff: Math.round(((pageViews - listingViews) / pageViews) * 100) },
        { step: 'Saves', users: saves, dropoff: Math.round(((listingViews - saves) / listingViews) * 100) },
        { step: 'Connections', users: connections, dropoff: Math.round(((saves - connections) / saves) * 100) }
      ];

      // Get listing performance data
      const { data: listingPerformance } = await supabase
        .from('listing_analytics')
        .select(`
          listing_id,
          listings!listing_analytics_listing_id_fkey(title, revenue),
          action_type,
          time_spent
        `)
        .gte('created_at', startDate.toISOString());

      // Process listing performance
      const listingStats = new Map();
      
      listingPerformance?.forEach(item => {
        const id = item.listing_id;
        if (!listingStats.has(id)) {
          listingStats.set(id, {
            listing_id: id,
            listing_title: item.listings?.title || 'Unknown',
            revenue: item.listings?.revenue || 0,
            views: 0,
            saves: 0,
            connections: 0,
            total_time: 0,
            view_count: 0
          });
        }
        
        const stats = listingStats.get(id);
        if (item.action_type === 'view') {
          stats.views++;
          if (item.time_spent) {
            stats.total_time += item.time_spent;
            stats.view_count++;
          }
        } else if (item.action_type === 'save') {
          stats.saves++;
        } else if (item.action_type === 'connect') {
          stats.connections++;
        }
      });

      // Get saved listings count
      const { data: savedListings } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .gte('created_at', startDate.toISOString());

      savedListings?.forEach(item => {
        if (listingStats.has(item.listing_id)) {
          listingStats.get(item.listing_id).saves++;
        }
      });

      // Get connection requests count
      const { data: connectionRequests } = await supabase
        .from('connection_requests')
        .select('listing_id')
        .gte('created_at', startDate.toISOString());

      connectionRequests?.forEach(item => {
        if (listingStats.has(item.listing_id)) {
          listingStats.get(item.listing_id).connections++;
        }
      });

      const listingConversions: ListingConversionData[] = Array.from(listingStats.values())
        .map(stats => ({
          ...stats,
          conversion_rate: stats.views > 0 ? (stats.connections / stats.views) * 100 : 0,
          avg_view_duration: stats.view_count > 0 ? stats.total_time / stats.view_count : 0
        }))
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, 10);

      return {
        conversionFunnel,
        listingConversions,
        overallConversionRate: pageViews > 0 ? (connections / pageViews) * 100 : 0
      };
    },
    refetchInterval: 300000, // 5 minutes
  });
}