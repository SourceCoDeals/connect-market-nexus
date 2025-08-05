import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketGap {
  search_query: string;
  search_count: number;
  no_results_rate: number;
  avg_results: number;
  demand_score: number;
  suggested_categories: string[];
}

export interface PricingInsight {
  category: string;
  revenue_range: string;
  listing_count: number;
  avg_views: number;
  avg_conversion_rate: number;
  optimal_pricing: {
    min: number;
    max: number;
    sweet_spot: number;
  };
}

export interface CategoryTrend {
  category: string;
  current_listings: number;
  views_trend: number;
  saves_trend: number;
  connections_trend: number;
  growth_rate: number;
  market_saturation: 'low' | 'medium' | 'high';
  opportunity_score: number;
}

export interface GeographicInsight {
  location: string;
  user_count: number;
  listing_count: number;
  demand_supply_ratio: number;
  avg_user_engagement: number;
  expansion_opportunity: 'high' | 'medium' | 'low';
}

export function useMarketIntelligence(daysBack: number = 30) {
  return useQuery({
    queryKey: ['market-intelligence', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Market gaps analysis
      const { data: searchData } = await supabase
        .from('search_analytics')
        .select('search_query, results_count, results_clicked')
        .gte('created_at', startDate.toISOString());

      const searchMap = new Map();
      searchData?.forEach(search => {
        const query = search.search_query.toLowerCase();
        if (!searchMap.has(query)) {
          searchMap.set(query, {
            count: 0,
            noResults: 0,
            totalResults: 0
          });
        }
        const data = searchMap.get(query);
        data.count++;
        data.totalResults += search.results_count || 0;
        if ((search.results_count || 0) === 0) data.noResults++;
      });

      const marketGaps: MarketGap[] = Array.from(searchMap.entries())
        .map(([query, data]) => ({
          search_query: query,
          search_count: data.count,
          no_results_rate: (data.noResults / data.count) * 100,
          avg_results: data.totalResults / data.count,
          demand_score: Math.min(data.count * (data.noResults / data.count) * 10, 100),
          suggested_categories: [] // Could be enhanced with AI categorization
        }))
        .filter(gap => gap.search_count >= 3)
        .sort((a, b) => b.demand_score - a.demand_score);

      // Pricing intelligence
      const { data: listings } = await supabase
        .from('listings')
        .select(`
          id, category, revenue, ebitda,
          listing_analytics!listing_analytics_listing_id_fkey(action_type),
          saved_listings!saved_listings_listing_id_fkey(id),
          connection_requests!connection_requests_listing_id_fkey(status)
        `)
        .eq('status', 'active')
        .is('deleted_at', null);

      const categoryMap = new Map();
      listings?.forEach(listing => {
        if (!categoryMap.has(listing.category)) {
          categoryMap.set(listing.category, []);
        }
        
        const views = listing.listing_analytics?.filter(a => a.action_type === 'view').length || 0;
        const saves = listing.saved_listings?.length || 0;
        const connections = listing.connection_requests?.filter(c => c.status === 'approved').length || 0;
        
        categoryMap.get(listing.category).push({
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          views,
          saves,
          connections,
          conversion_rate: views > 0 ? (connections / views) * 100 : 0
        });
      });

      const pricingInsights: PricingInsight[] = Array.from(categoryMap.entries())
        .map(([category, listings]) => {
          const revenues = listings.map((l: any) => l.revenue).sort((a: number, b: number) => a - b);
          const avgViews = listings.reduce((sum: number, l: any) => sum + l.views, 0) / listings.length;
          const avgConversion = listings.reduce((sum: number, l: any) => sum + l.conversion_rate, 0) / listings.length;
          
          // Find optimal pricing range based on performance
          const highPerformers = listings.filter((l: any) => l.conversion_rate > avgConversion);
          const optimalRevenues = highPerformers.map((l: any) => l.revenue);
          
          return {
            category,
            revenue_range: `$${(revenues[0] / 1000000).toFixed(1)}M - $${(revenues[revenues.length - 1] / 1000000).toFixed(1)}M`,
            listing_count: listings.length,
            avg_views: Math.round(avgViews),
            avg_conversion_rate: avgConversion,
            optimal_pricing: {
              min: Math.min(...optimalRevenues) || revenues[0],
              max: Math.max(...optimalRevenues) || revenues[revenues.length - 1],
              sweet_spot: optimalRevenues.length > 0 ? 
                optimalRevenues.reduce((sum, r) => sum + r, 0) / optimalRevenues.length :
                revenues[Math.floor(revenues.length / 2)]
            }
          };
        })
        .filter(insight => insight.listing_count >= 3);

      // Category trends
      const categoryTrends: CategoryTrend[] = Array.from(categoryMap.entries())
        .map(([category, listings]) => {
          const currentListings = listings.length;
          const totalViews = listings.reduce((sum: number, l: any) => sum + l.views, 0);
          const totalSaves = listings.reduce((sum: number, l: any) => sum + l.saves, 0);
          const totalConnections = listings.reduce((sum: number, l: any) => sum + l.connections, 0);
          
          // Simple saturation calculation based on listing count vs average performance
          const avgPerformance = totalViews / currentListings;
          let saturation: 'low' | 'medium' | 'high' = 'low';
          if (currentListings > 20 && avgPerformance < 10) saturation = 'high';
          else if (currentListings > 10 && avgPerformance < 20) saturation = 'medium';
          
          const opportunityScore = Math.max(100 - (currentListings * 5) + (avgPerformance * 2), 0);
          
          return {
            category,
            current_listings: currentListings,
            views_trend: totalViews,
            saves_trend: totalSaves,
            connections_trend: totalConnections,
            growth_rate: 0, // Would need historical data
            market_saturation: saturation,
            opportunity_score: Math.min(opportunityScore, 100)
          };
        })
        .sort((a, b) => b.opportunity_score - a.opportunity_score);

      // Geographic insights
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select(`
          id, target_locations,
          listing_analytics!listing_analytics_user_id_fkey(action_type),
          saved_listings!saved_listings_user_id_fkey(id),
          connection_requests!connection_requests_user_id_fkey(id)
        `)
        .eq('approval_status', 'approved');

      const locationMap = new Map();
      userProfiles?.forEach(profile => {
        if (!profile.target_locations) return;
        
        const locations = profile.target_locations.split(',').map(l => l.trim());
        const userEngagement = (profile.listing_analytics?.length || 0) + 
                              (profile.saved_listings?.length || 0) + 
                              (profile.connection_requests?.length || 0);
        
        locations.forEach(location => {
          if (!locationMap.has(location)) {
            locationMap.set(location, {
              users: 0,
              totalEngagement: 0
            });
          }
          const data = locationMap.get(location);
          data.users++;
          data.totalEngagement += userEngagement;
        });
      });

      // Get listing locations
      const { data: listingLocations } = await supabase
        .from('listings')
        .select('location')
        .eq('status', 'active')
        .is('deleted_at', null);

      const listingLocationMap = new Map();
      listingLocations?.forEach(listing => {
        const location = listing.location;
        listingLocationMap.set(location, (listingLocationMap.get(location) || 0) + 1);
      });

      const geographicInsights: GeographicInsight[] = Array.from(locationMap.entries())
        .map(([location, data]) => {
          const listingCount = listingLocationMap.get(location) || 0;
          const demandSupplyRatio = listingCount > 0 ? data.users / listingCount : data.users;
          const avgEngagement = data.users > 0 ? data.totalEngagement / data.users : 0;
          
          let expansionOpportunity: 'high' | 'medium' | 'low' = 'low';
          if (demandSupplyRatio > 10 && avgEngagement > 5) expansionOpportunity = 'high';
          else if (demandSupplyRatio > 5 || avgEngagement > 3) expansionOpportunity = 'medium';
          
          return {
            location,
            user_count: data.users,
            listing_count: listingCount,
            demand_supply_ratio: demandSupplyRatio,
            avg_user_engagement: avgEngagement,
            expansion_opportunity: expansionOpportunity
          };
        })
        .filter(insight => insight.user_count >= 3)
        .sort((a, b) => b.demand_supply_ratio - a.demand_supply_ratio);

      return {
        marketGaps: marketGaps.slice(0, 10),
        pricingInsights,
        categoryTrends,
        geographicInsights
      };
    },
    refetchInterval: 600000, // Refetch every 10 minutes
  });
}