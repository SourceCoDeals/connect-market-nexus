import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DealPrediction {
  listing_id: string;
  listing_title: string;
  category: string;
  revenue: number;
  ebitda: number;
  probability_score: number;
  interested_users: number;
  avg_user_engagement: number;
  days_on_market: number;
}

interface MarketDemand {
  category: string;
  search_volume: number;
  avg_listing_views: number;
  conversion_rate: number;
  revenue_range_demand: {
    range: string;
    demand_score: number;
  }[];
}

export function useRevenueIntelligence(daysBack: number = 30) {
  return useQuery({
    queryKey: ['revenue-intelligence', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get listing data with engagement metrics
      const { data: listingsData } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          category,
          revenue,
          ebitda,
          created_at,
          status
        `)
        .eq('status', 'active')
        .not('deleted_at', 'is', null);

      // Get engagement data for each listing
      const listingIds = listingsData?.map(l => l.id) || [];
      
      const { data: analyticsData } = await supabase
        .from('listing_analytics')
        .select('listing_id, user_id, action_type, time_spent')
        .in('listing_id', listingIds)
        .gte('created_at', startDate.toISOString());

      const { data: savedData } = await supabase
        .from('saved_listings')
        .select('listing_id, user_id')
        .in('listing_id', listingIds)
        .gte('created_at', startDate.toISOString());

      const { data: connectionData } = await supabase
        .from('connection_requests')
        .select('listing_id, user_id, status')
        .in('listing_id', listingIds)
        .gte('created_at', startDate.toISOString());

      // Calculate deal predictions
      const dealPredictions: DealPrediction[] = listingsData?.map(listing => {
        const analytics = analyticsData?.filter(a => a.listing_id === listing.id) || [];
        const saves = savedData?.filter(s => s.listing_id === listing.id) || [];
        const connections = connectionData?.filter(c => c.listing_id === listing.id) || [];
        
        const views = analytics.filter(a => a.action_type === 'view').length;
        const uniqueViewers = new Set(analytics.filter(a => a.action_type === 'view').map(a => a.user_id)).size;
        const avgTimeSpent = analytics
          .filter(a => a.time_spent)
          .reduce((sum, a) => sum + (a.time_spent || 0), 0) / Math.max(views, 1);
        
        const interestedUsers = new Set([
          ...saves.map(s => s.user_id),
          ...connections.map(c => c.user_id)
        ]).size;

        const daysOnMarket = Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate probability score (0-100)
        const viewScore = Math.min(views / 50 * 30, 30); // Max 30 points for views
        const saveScore = Math.min(saves.length / 10 * 25, 25); // Max 25 points for saves
        const connectionScore = Math.min(connections.length / 5 * 25, 25); // Max 25 points for connections
        const timeScore = Math.min(avgTimeSpent / 300 * 20, 20); // Max 20 points for time spent (5 min = max)
        
        const probabilityScore = viewScore + saveScore + connectionScore + timeScore;

        return {
          listing_id: listing.id,
          listing_title: listing.title,
          category: listing.category,
          revenue: listing.revenue,
          ebitda: listing.ebitda,
          probability_score: Math.round(probabilityScore),
          interested_users: interestedUsers,
          avg_user_engagement: avgTimeSpent,
          days_on_market: daysOnMarket
        };
      }).sort((a, b) => b.probability_score - a.probability_score) || [];

      // Analyze market demand by category
      const { data: searchAnalytics } = await supabase
        .from('search_analytics')
        .select('search_query, results_count, results_clicked')
        .gte('created_at', startDate.toISOString());

      // Category mapping for search terms
      const categoryKeywords = {
        'Technology': ['tech', 'software', 'saas', 'ai', 'ml', 'fintech', 'app'],
        'Healthcare': ['health', 'medical', 'pharma', 'biotech', 'wellness'],
        'Manufacturing': ['manufacturing', 'industrial', 'factory', 'production'],
        'Retail': ['retail', 'ecommerce', 'store', 'shopping', 'consumer'],
        'Services': ['service', 'consulting', 'agency', 'professional']
      };

      const categoryDemand = new Map();
      
      Object.keys(categoryKeywords).forEach(category => {
        categoryDemand.set(category, {
          category,
          search_volume: 0,
          total_results: 0,
          total_clicks: 0,
          searches: 0
        });
      });

      searchAnalytics?.forEach(search => {
        const query = search.search_query.toLowerCase();
        
        Object.entries(categoryKeywords).forEach(([category, keywords]) => {
          if (keywords.some(keyword => query.includes(keyword))) {
            const demand = categoryDemand.get(category);
            demand.search_volume++;
            demand.total_results += search.results_count || 0;
            demand.total_clicks += search.results_clicked || 0;
            demand.searches++;
          }
        });
      });

      // Get listing views by category
      const categoryViews = new Map();
      listingsData?.forEach(listing => {
        const views = analyticsData?.filter(a => 
          a.listing_id === listing.id && a.action_type === 'view'
        ).length || 0;
        
        if (!categoryViews.has(listing.category)) {
          categoryViews.set(listing.category, { views: 0, listings: 0 });
        }
        
        const catData = categoryViews.get(listing.category);
        catData.views += views;
        catData.listings++;
      });

      const marketDemand: MarketDemand[] = Array.from(categoryDemand.values())
        .map(demand => ({
          category: demand.category,
          search_volume: demand.search_volume,
          avg_listing_views: categoryViews.has(demand.category) ? 
            Math.round(categoryViews.get(demand.category).views / Math.max(categoryViews.get(demand.category).listings, 1)) : 0,
          conversion_rate: demand.searches > 0 ? (demand.total_clicks / demand.searches) * 100 : 0,
          revenue_range_demand: [] // Will be populated with more complex analysis
        }))
        .sort((a, b) => b.search_volume - a.search_volume);

      // Calculate user lifetime value indicators
      const { data: userMetrics } = await supabase
        .from('engagement_scores')
        .select(`
          user_id,
          score,
          listings_viewed,
          connections_requested,
          profiles!engagement_scores_user_id_fkey(created_at)
        `)
        .gte('score', 50);

      const avgUserValue = userMetrics?.reduce((sum, user) => {
        const accountAge = Math.floor((Date.now() - new Date(user.profiles?.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
        const valueScore = (user.listings_viewed * 2) + (user.connections_requested * 10) + (user.score / 10);
        return sum + (valueScore / Math.max(accountAge, 1)); // Value per day
      }, 0) / Math.max(userMetrics?.length || 1, 1);

      return {
        dealPredictions: dealPredictions.slice(0, 15),
        marketDemand,
        avgUserLifetimeValue: Math.round(avgUserValue * 365), // Annualized
        totalActiveDealValue: dealPredictions.reduce((sum, deal) => sum + deal.revenue, 0),
        highProbabilityDeals: dealPredictions.filter(d => d.probability_score > 60).length
      };
    },
    refetchInterval: 600000, // 10 minutes
  });
}