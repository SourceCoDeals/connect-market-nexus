import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface EngagementAnalyticsData {
  // Listing leaderboard
  listingLeaderboard: Array<{
    id: string;
    title: string;
    category: string;
    views: number;
    saves: number;
    requests: number;
    conversionRate: number;
  }>;
  
  // Engagement funnel
  funnelMetrics: {
    totalViews: number;
    totalSaves: number;
    totalRequests: number;
    viewToSaveRate: number;
    saveToRequestRate: number;
    viewToRequestRate: number;
  };
  
  // Category performance
  categoryPerformance: Array<{
    category: string;
    views: number;
    saves: number;
    requests: number;
  }>;
  
  // Scroll depth analysis
  scrollDepthDistribution: Array<{
    depth: string;
    count: number;
    percentage: number;
  }>;
  
  // Average time on page by category
  avgTimeByCategory: Array<{
    category: string;
    avgSeconds: number;
  }>;

  // User journey paths
  userJourneyPaths: Array<{
    source: string;
    target: string;
    count: number;
  }>;
}

export function useEngagementAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['engagement-analytics', timeRangeDays],
    queryFn: async (): Promise<EngagementAnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch listing analytics
      const [analyticsResult, listingsResult, requestsResult, savedResult, referrerResult] = await Promise.all([
        supabase
          .from('listing_analytics')
          .select('listing_id, action_type, time_spent, scroll_depth')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('listings')
          .select('id, title, category')
          .eq('status', 'active'),
        supabase
          .from('connection_requests')
          .select('listing_id')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('saved_listings')
          .select('listing_id')
          .gte('created_at', startDate.toISOString()),
        // Referrer page data for user journey
        supabase
          .from('listing_analytics')
          .select('referrer_page, action_type')
          .gte('created_at', startDate.toISOString())
          .eq('action_type', 'view')
          .not('referrer_page', 'is', null),
      ]);
      
      const analytics = analyticsResult.data || [];
      const listings = listingsResult.data || [];
      const requests = requestsResult.data || [];
      const saved = savedResult.data || [];
      const referrerData = referrerResult.data || [];
      
      // Create listing lookup
      const listingMap = new Map(listings.map(l => [l.id, l]));
      
      // Count views by listing
      const viewCounts: Record<string, number> = {};
      const timeSpentByListing: Record<string, number[]> = {};
      const scrollDepthCounts: Record<string, number> = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
      
      analytics.forEach(a => {
        if (a.action_type === 'view' && a.listing_id) {
          viewCounts[a.listing_id] = (viewCounts[a.listing_id] || 0) + 1;
          
          if (a.time_spent) {
            if (!timeSpentByListing[a.listing_id]) {
              timeSpentByListing[a.listing_id] = [];
            }
            timeSpentByListing[a.listing_id].push(a.time_spent);
          }
          
          if (a.scroll_depth !== null && a.scroll_depth !== undefined) {
            const depth = Number(a.scroll_depth);
            if (depth <= 25) scrollDepthCounts['0-25']++;
            else if (depth <= 50) scrollDepthCounts['26-50']++;
            else if (depth <= 75) scrollDepthCounts['51-75']++;
            else scrollDepthCounts['76-100']++;
          }
        }
      });
      
      // Count saves by listing
      const saveCounts: Record<string, number> = {};
      saved.forEach(s => {
        if (s.listing_id) {
          saveCounts[s.listing_id] = (saveCounts[s.listing_id] || 0) + 1;
        }
      });
      
      // Count requests by listing
      const requestCounts: Record<string, number> = {};
      requests.forEach(r => {
        if (r.listing_id) {
          requestCounts[r.listing_id] = (requestCounts[r.listing_id] || 0) + 1;
        }
      });
      
      // Build listing leaderboard
      const listingLeaderboard = listings
        .map(listing => {
          const views = viewCounts[listing.id] || 0;
          const saves = saveCounts[listing.id] || 0;
          const reqs = requestCounts[listing.id] || 0;
          
          return {
            id: listing.id,
            title: listing.title,
            category: listing.category || 'Uncategorized',
            views,
            saves,
            requests: reqs,
            conversionRate: views > 0 ? (reqs / views) * 100 : 0,
          };
        })
        .filter(l => l.views > 0 || l.saves > 0 || l.requests > 0)
        .sort((a, b) => b.views - a.views)
        .slice(0, 20);
      
      // Calculate funnel metrics
      const totalViews = Object.values(viewCounts).reduce((sum, v) => sum + v, 0);
      const totalSaves = Object.values(saveCounts).reduce((sum, v) => sum + v, 0);
      const totalRequests = Object.values(requestCounts).reduce((sum, v) => sum + v, 0);
      
      const funnelMetrics = {
        totalViews,
        totalSaves,
        totalRequests,
        viewToSaveRate: totalViews > 0 ? (totalSaves / totalViews) * 100 : 0,
        saveToRequestRate: totalSaves > 0 ? (totalRequests / totalSaves) * 100 : 0,
        viewToRequestRate: totalViews > 0 ? (totalRequests / totalViews) * 100 : 0,
      };
      
      // Category performance
      const categoryData: Record<string, { views: number; saves: number; requests: number }> = {};
      
      listings.forEach(listing => {
        const cat = listing.category || 'Uncategorized';
        if (!categoryData[cat]) {
          categoryData[cat] = { views: 0, saves: 0, requests: 0 };
        }
        categoryData[cat].views += viewCounts[listing.id] || 0;
        categoryData[cat].saves += saveCounts[listing.id] || 0;
        categoryData[cat].requests += requestCounts[listing.id] || 0;
      });
      
      const categoryPerformance = Object.entries(categoryData)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      
      // Scroll depth distribution
      const totalScrollRecords = Object.values(scrollDepthCounts).reduce((sum, v) => sum + v, 0);
      const scrollDepthDistribution = Object.entries(scrollDepthCounts).map(([depth, count]) => ({
        depth: depth + '%',
        count,
        percentage: totalScrollRecords > 0 ? (count / totalScrollRecords) * 100 : 0,
      }));
      
      // Average time by category
      const categoryTimeData: Record<string, number[]> = {};
      listings.forEach(listing => {
        const cat = listing.category || 'Uncategorized';
        const times = timeSpentByListing[listing.id] || [];
        if (!categoryTimeData[cat]) {
          categoryTimeData[cat] = [];
        }
        categoryTimeData[cat].push(...times);
      });
      
      const avgTimeByCategory = Object.entries(categoryTimeData)
        .map(([category, times]) => ({
          category,
          avgSeconds: times.length > 0 
            ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
            : 0,
        }))
        .filter(c => c.avgSeconds > 0)
        .sort((a, b) => b.avgSeconds - a.avgSeconds)
        .slice(0, 8);
      // User journey paths - aggregate referrer pages to listing actions
      const journeyPathCounts: Record<string, number> = {};
      referrerData.forEach(r => {
        if (r.referrer_page) {
          const source = parseReferrerSource(r.referrer_page);
          const key = `${source}->Listing`;
          journeyPathCounts[key] = (journeyPathCounts[key] || 0) + 1;
        }
      });
      
      const userJourneyPaths = Object.entries(journeyPathCounts)
        .map(([path, count]) => {
          const [source, target] = path.split('->');
          return { source, target, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return {
        listingLeaderboard,
        funnelMetrics,
        categoryPerformance,
        scrollDepthDistribution,
        avgTimeByCategory,
        userJourneyPaths,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

function parseReferrerSource(referrer: string): string {
  if (!referrer) return 'Direct';
  
  const lowerRef = referrer.toLowerCase();
  
  // Categorize by common patterns
  if (lowerRef.includes('/search') || lowerRef.includes('search?')) return 'Search Page';
  if (lowerRef.includes('/category') || lowerRef.includes('/categories')) return 'Category Page';
  if (lowerRef === '/' || lowerRef.endsWith('/home')) return 'Home Page';
  if (lowerRef.includes('/listing')) return 'Other Listing';
  if (lowerRef.includes('google.com')) return 'Google';
  if (lowerRef.includes('linkedin.com')) return 'LinkedIn';
  if (lowerRef.includes('email') || lowerRef.includes('brevo')) return 'Email Campaign';
  
  return 'External';
}
