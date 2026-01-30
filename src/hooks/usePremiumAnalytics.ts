import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

export interface PremiumAnalyticsData {
  // Hero stats
  connectionRequestsCount: number;
  connectionRequestsTrend: number;
  connectionRequestsSparkline: number[];
  
  dealActivityCount: number;
  dealActivityTrend: number;
  dealActivitySparkline: number[];
  
  approvedBuyersCount: number;
  approvedBuyersTrend: number;
  approvedBuyersSparkline: number[];
  
  conversionRate: number;
  conversionRateTrend: number;
  conversionRateSparkline: number[];
  
  // Buyer breakdown
  buyerTypeBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  
  // Connection velocity (daily data for chart)
  connectionVelocity: Array<{
    date: string;
    count: number;
  }>;
  
  // Listing performance by category
  listingPerformance: Array<{
    category: string;
    connectionCount: number;
    listingCount: number;
  }>;
  
  // Deal flow funnel
  funnelData: {
    totalSignups: number;
    approvedBuyers: number;
    connectionRequests: number;
    introductionsMade: number;
  };
  
  // Top performing listings
  topListings: Array<{
    id: string;
    title: string;
    connectionCount: number;
    category: string;
  }>;
  
  // Action items
  actionItems: {
    pendingRequests: number;
    newSignupsToReview: number;
    requestsOnHold: number;
    staleListings: number;
  };
}

export function usePremiumAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['premium-analytics', timeRangeDays],
    queryFn: async (): Promise<PremiumAnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      const previousPeriodStart = subDays(startDate, timeRangeDays);
      
      // Fetch all data in parallel
      const [
        connectionRequestsResult,
        previousConnectionRequestsResult,
        profilesResult,
        previousProfilesResult,
        buyerTypesResult,
        listingsResult,
        topListingsResult,
        pendingRequestsResult,
        newSignupsResult,
        onHoldRequestsResult,
        introductionsResult,
      ] = await Promise.all([
        // Connection requests in current period
        supabase
          .from('connection_requests')
          .select('id, created_at, status')
          .gte('created_at', startDate.toISOString()),
          
        // Connection requests in previous period
        supabase
          .from('connection_requests')
          .select('id, created_at')
          .gte('created_at', previousPeriodStart.toISOString())
          .lt('created_at', startDate.toISOString()),
          
        // Approved profiles in current period
        supabase
          .from('profiles')
          .select('id, created_at, approval_status')
          .eq('approval_status', 'approved'),
          
        // Approved profiles created in previous period (for trend)
        supabase
          .from('profiles')
          .select('id, created_at')
          .eq('approval_status', 'approved')
          .gte('created_at', previousPeriodStart.toISOString())
          .lt('created_at', startDate.toISOString()),
          
        // Buyer type breakdown
        supabase
          .from('profiles')
          .select('buyer_type')
          .eq('approval_status', 'approved')
          .not('buyer_type', 'is', null),
          
        // Listings with connection counts
        supabase
          .from('listings')
          .select(`
            id,
            title,
            category,
            connection_requests(id)
          `)
          .eq('status', 'active'),
          
        // Top performing listings
        supabase
          .from('connection_requests')
          .select(`
            listing_id,
            listings!inner(id, title, category)
          `)
          .gte('created_at', startDate.toISOString()),
          
        // Pending requests count
        supabase
          .from('connection_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
          
        // New signups to review
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('approval_status', 'pending'),
          
        // On-hold requests
        supabase
          .from('connection_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'on_hold'),
          
        // Introductions made (approved connections)
        supabase
          .from('connection_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
      ]);

      const connectionRequests = connectionRequestsResult.data || [];
      const previousConnectionRequests = previousConnectionRequestsResult.data || [];
      const approvedProfiles = profilesResult.data || [];
      const previousApprovedProfiles = previousProfilesResult.data || [];
      const buyerTypes = buyerTypesResult.data || [];
      const listings = listingsResult.data || [];
      const topListingsData = topListingsResult.data || [];

      // Calculate connection requests metrics
      const connectionRequestsCount = connectionRequests.length;
      const previousConnectionCount = previousConnectionRequests.length;
      const connectionRequestsTrend = previousConnectionCount > 0
        ? ((connectionRequestsCount - previousConnectionCount) / previousConnectionCount) * 100
        : 100;

      // Calculate sparkline data (last 7 days)
      const connectionRequestsSparkline = generateSparklineData(connectionRequests, 7);

      // Calculate approved buyers in current period
      const approvedInPeriod = approvedProfiles.filter(
        p => new Date(p.created_at) >= startDate
      ).length;
      const previousApprovedCount = previousApprovedProfiles.length;
      const approvedBuyersTrend = previousApprovedCount > 0
        ? ((approvedInPeriod - previousApprovedCount) / previousApprovedCount) * 100
        : 100;

      // Calculate conversion rate (pending -> approved)
      const approvedRequests = connectionRequests.filter(r => r.status === 'approved').length;
      const conversionRate = connectionRequestsCount > 0
        ? (approvedRequests / connectionRequestsCount) * 100
        : 0;

      // Buyer type breakdown
      const buyerTypeCounts: Record<string, number> = {};
      buyerTypes.forEach(p => {
        const type = p.buyer_type || 'Other';
        buyerTypeCounts[type] = (buyerTypeCounts[type] || 0) + 1;
      });
      
      const totalBuyers = buyerTypes.length;
      const buyerTypeBreakdown = Object.entries(buyerTypeCounts)
        .map(([type, count]) => ({
          type: formatBuyerType(type),
          count,
          percentage: totalBuyers > 0 ? (count / totalBuyers) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Connection velocity (daily data)
      const connectionVelocity = generateDailyData(connectionRequests, timeRangeDays);

      // Listing performance by category
      const categoryPerformance: Record<string, { connections: number; listings: number }> = {};
      listings.forEach(listing => {
        const category = listing.category || 'Uncategorized';
        if (!categoryPerformance[category]) {
          categoryPerformance[category] = { connections: 0, listings: 0 };
        }
        categoryPerformance[category].listings += 1;
        categoryPerformance[category].connections += (listing.connection_requests as any[])?.length || 0;
      });
      
      const listingPerformance = Object.entries(categoryPerformance)
        .map(([category, data]) => ({
          category,
          connectionCount: data.connections,
          listingCount: data.listings,
        }))
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, 8);

      // Top performing listings
      const listingConnectionCounts: Record<string, { count: number; title: string; category: string }> = {};
      topListingsData.forEach(req => {
        const listing = req.listings as any;
        if (listing?.id) {
          if (!listingConnectionCounts[listing.id]) {
            listingConnectionCounts[listing.id] = {
              count: 0,
              title: listing.title || 'Untitled',
              category: listing.category || 'Uncategorized',
            };
          }
          listingConnectionCounts[listing.id].count += 1;
        }
      });
      
      const topListings = Object.entries(listingConnectionCounts)
        .map(([id, data]) => ({
          id,
          title: data.title,
          connectionCount: data.count,
          category: data.category,
        }))
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, 5);

      // Funnel data
      const totalSignups = approvedProfiles.length + (newSignupsResult.count || 0);
      
      return {
        connectionRequestsCount,
        connectionRequestsTrend,
        connectionRequestsSparkline,
        
        dealActivityCount: connectionRequests.length,
        dealActivityTrend: connectionRequestsTrend,
        dealActivitySparkline: connectionRequestsSparkline,
        
        approvedBuyersCount: approvedProfiles.length,
        approvedBuyersTrend,
        approvedBuyersSparkline: generateSparklineData(
          approvedProfiles.map(p => ({ created_at: p.created_at })), 
          7
        ),
        
        conversionRate,
        conversionRateTrend: 0, // Would need historical data to calculate
        conversionRateSparkline: [18, 22, 19, 24, 21, 23, conversionRate],
        
        buyerTypeBreakdown,
        connectionVelocity,
        listingPerformance,
        
        funnelData: {
          totalSignups,
          approvedBuyers: approvedProfiles.length,
          connectionRequests: connectionRequestsCount,
          introductionsMade: introductionsResult.count || 0,
        },
        
        topListings,
        
        actionItems: {
          pendingRequests: pendingRequestsResult.count || 0,
          newSignupsToReview: newSignupsResult.count || 0,
          requestsOnHold: onHoldRequestsResult.count || 0,
          staleListings: 0, // Would need additional query
        },
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

function generateSparklineData(
  data: Array<{ created_at: string }>,
  days: number
): number[] {
  const now = new Date();
  const result: number[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const dayEnd = startOfDay(subDays(now, i - 1));
    
    const count = data.filter(item => {
      const date = new Date(item.created_at);
      return date >= dayStart && date < dayEnd;
    }).length;
    
    result.push(count);
  }
  
  return result;
}

function generateDailyData(
  data: Array<{ created_at: string }>,
  days: number
): Array<{ date: string; count: number }> {
  const now = new Date();
  const result: Array<{ date: string; count: number }> = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const dayEnd = startOfDay(subDays(now, i - 1));
    
    const count = data.filter(item => {
      const date = new Date(item.created_at);
      return date >= dayStart && date < dayEnd;
    }).length;
    
    result.push({
      date: format(dayStart, 'MMM d'),
      count,
    });
  }
  
  return result;
}

function formatBuyerType(type: string): string {
  const typeMap: Record<string, string> = {
    'private_equity': 'Private Equity',
    'pe': 'Private Equity',
    'individual': 'Individual',
    'independent_sponsor': 'Independent Sponsor',
    'search_fund': 'Search Fund',
    'family_office': 'Family Office',
    'corporate': 'Corporate',
    'strategic': 'Strategic',
  };
  
  return typeMap[type.toLowerCase()] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
