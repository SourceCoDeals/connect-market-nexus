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
  
  // Buyer breakdown for transaction panel
  buyerTypeBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;

  // Transaction activity (accounts + connections by type)
  transactionActivity: Array<{
    type: string;
    accounts: number;
    connections: number;
  }>;
  
  // Connection velocity (daily data for chart)
  connectionVelocity: Array<{
    date: string;
    count: number;
  }>;

  // Multi-series velocity by buyer type
  velocityByBuyerType: Array<{
    date: string;
    pe: number;
    individual: number;
    searchFund: number;
    other: number;
  }>;
  
  // Geography data
  buyerGeography: Array<{
    region: string;
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
  
  // Recent activity for feed
  recentActivity: Array<{
    id: string;
    userName: string;
    userType: string;
    action: string;
    timestamp: string;
    targetTitle?: string;
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
        recentActivityResult,
        geographyResult,
      ] = await Promise.all([
        // Connection requests in current period - limit to 500 for performance
        supabase
          .from('connection_requests')
          .select('id, created_at, status, user_id')
          .gte('created_at', startDate.toISOString())
          .limit(500),
          
        // Connection requests in previous period
        supabase
          .from('connection_requests')
          .select('id, created_at')
          .gte('created_at', previousPeriodStart.toISOString())
          .lt('created_at', startDate.toISOString())
          .limit(500),
          
        // Approved profiles in current period - limit to recent 500
        supabase
          .from('profiles')
          .select('id, created_at, approval_status, buyer_type')
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(500),
          
        // Approved profiles created in previous period (for trend)
        supabase
          .from('profiles')
          .select('id, created_at')
          .eq('approval_status', 'approved')
          .gte('created_at', previousPeriodStart.toISOString())
          .lt('created_at', startDate.toISOString())
          .limit(200),
          
        // Buyer type breakdown - limit to 500
        supabase
          .from('profiles')
          .select('id, buyer_type')
          .eq('approval_status', 'approved')
          .not('buyer_type', 'is', null)
          .limit(500),
          
        // Listings with category only (no expensive nested join)
        supabase
          .from('listings')
          .select('id, title, category')
          .eq('status', 'active')
          .limit(200),
          
        // Top performing listings - limit to 100 recent
        supabase
          .from('connection_requests')
          .select(`
            listing_id,
            listings!inner(id, title, category)
          `)
          .gte('created_at', startDate.toISOString())
          .limit(200),
          
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

        // Recent activity - get latest connection requests with user info
        supabase
          .from('connection_requests')
          .select(`
            id,
            created_at,
            user_id,
            listings!connection_requests_listing_id_fkey(title)
          `)
          .order('created_at', { ascending: false })
          .limit(10),

        // Geography from profiles - limit to 200
        supabase
          .from('profiles')
          .select('target_locations')
          .eq('approval_status', 'approved')
          .not('target_locations', 'is', null)
          .limit(200),
      ]);

      const connectionRequests = connectionRequestsResult.data || [];
      const previousConnectionRequests = previousConnectionRequestsResult.data || [];
      const approvedProfiles = profilesResult.data || [];
      const previousApprovedProfiles = previousProfilesResult.data || [];
      const buyerTypes = buyerTypesResult.data || [];
      const listings = listingsResult.data || [];
      const topListingsData = topListingsResult.data || [];
      const recentActivityData = recentActivityResult.data || [];
      const geographyData = geographyResult.data || [];

      // Get user details for recent activity
      const userIds = [...new Set(recentActivityData.map(r => r.user_id).filter(Boolean))];
      let userProfiles: any[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, buyer_type')
          .in('id', userIds);
        userProfiles = data || [];
      }

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

      // Buyer type breakdown with connection counts
      const buyerTypeCounts: Record<string, { accounts: number; connections: number }> = {};
      const userBuyerTypes: Record<string, string> = {};
      
      buyerTypes.forEach(p => {
        const type = p.buyer_type || 'Other';
        const formattedType = formatBuyerType(type);
        if (!buyerTypeCounts[formattedType]) {
          buyerTypeCounts[formattedType] = { accounts: 0, connections: 0 };
        }
        buyerTypeCounts[formattedType].accounts += 1;
        userBuyerTypes[p.id] = formattedType;
      });

      // Count connections by buyer type
      connectionRequests.forEach(req => {
        if (req.user_id && userBuyerTypes[req.user_id]) {
          buyerTypeCounts[userBuyerTypes[req.user_id]].connections += 1;
        }
      });
      
      const totalBuyers = buyerTypes.length;
      const buyerTypeBreakdown = Object.entries(buyerTypeCounts)
        .map(([type, data]) => ({
          type,
          count: data.accounts,
          percentage: totalBuyers > 0 ? (data.accounts / totalBuyers) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const transactionActivity = Object.entries(buyerTypeCounts)
        .map(([type, data]) => ({
          type,
          accounts: data.accounts,
          connections: data.connections,
        }))
        .sort((a, b) => b.accounts - a.accounts);

      // Connection velocity (daily data)
      const connectionVelocity = generateDailyData(connectionRequests, timeRangeDays);

      // Multi-series velocity by buyer type (weekly buckets for cleaner display)
      const velocityByBuyerType = generateVelocityByType(connectionRequests, userBuyerTypes, timeRangeDays);

      // Geography data
      const geographyCounts: Record<string, number> = {};
      geographyData.forEach(profile => {
        const locations = profile.target_locations as string[] | null;
        if (locations) {
          locations.forEach(loc => {
            geographyCounts[loc] = (geographyCounts[loc] || 0) + 1;
          });
        }
      });
      const buyerGeography = Object.entries(geographyCounts)
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);

      // Listing performance by category - count connections per category using topListingsData
      const categoryConnections: Record<string, number> = {};
      const categoryListingCounts: Record<string, number> = {};
      
      listings.forEach(listing => {
        const category = listing.category || 'Uncategorized';
        categoryListingCounts[category] = (categoryListingCounts[category] || 0) + 1;
      });
      
      topListingsData.forEach(req => {
        const listing = req.listings as any;
        if (listing?.category) {
          const cat = listing.category || 'Uncategorized';
          categoryConnections[cat] = (categoryConnections[cat] || 0) + 1;
        }
      });
      
      const listingPerformance = Object.keys(categoryListingCounts)
        .map(category => ({
          category,
          connectionCount: categoryConnections[category] || 0,
          listingCount: categoryListingCounts[category],
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

      // Recent activity
      const userProfileMap = new Map(userProfiles.map(p => [p.id, p]));
      const recentActivity = recentActivityData.map(activity => {
        const user = userProfileMap.get(activity.user_id);
        const listing = activity.listings as any;
        return {
          id: activity.id,
          userName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
          userType: user ? formatBuyerType(user.buyer_type || 'Unknown') : 'Unknown',
          action: 'connection_request',
          timestamp: activity.created_at,
          targetTitle: listing?.title || undefined,
        };
      });

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
        conversionRateTrend: calculateConversionRateTrend(connectionRequests, previousConnectionRequests),
        conversionRateSparkline: generateConversionRateSparkline(connectionRequests, 7),
        
        buyerTypeBreakdown,
        transactionActivity,
        connectionVelocity,
        velocityByBuyerType,
        buyerGeography,
        listingPerformance,
        
        funnelData: {
          totalSignups,
          approvedBuyers: approvedProfiles.length,
          connectionRequests: connectionRequestsCount,
          introductionsMade: introductionsResult.count || 0,
        },
        
        topListings,
        recentActivity,
        
        actionItems: {
          pendingRequests: pendingRequestsResult.count || 0,
          newSignupsToReview: newSignupsResult.count || 0,
          requestsOnHold: onHoldRequestsResult.count || 0,
          staleListings: 0,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes (was 60s)
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

function generateVelocityByType(
  requests: Array<{ created_at: string; user_id: string | null }>,
  userBuyerTypes: Record<string, string>,
  days: number
): Array<{ date: string; pe: number; individual: number; searchFund: number; other: number }> {
  const now = new Date();
  const bucketSize = days <= 7 ? 1 : days <= 30 ? 7 : 14; // Daily, weekly, or bi-weekly
  const numBuckets = Math.ceil(days / bucketSize);
  const result: Array<{ date: string; pe: number; individual: number; searchFund: number; other: number }> = [];
  
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketEnd = subDays(now, i * bucketSize);
    const bucketStart = subDays(now, (i + 1) * bucketSize);
    
    const counts = { pe: 0, individual: 0, searchFund: 0, other: 0 };
    
    requests.forEach(req => {
      const date = new Date(req.created_at);
      if (date >= bucketStart && date < bucketEnd) {
        const buyerType = req.user_id ? userBuyerTypes[req.user_id] : null;
        if (buyerType?.toLowerCase().includes('equity')) {
          counts.pe += 1;
        } else if (buyerType?.toLowerCase().includes('individual')) {
          counts.individual += 1;
        } else if (buyerType?.toLowerCase().includes('search')) {
          counts.searchFund += 1;
        } else {
          counts.other += 1;
        }
      }
    });
    
    result.push({
      date: format(bucketEnd, 'MMM d'),
      ...counts,
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

function calculateConversionRateTrend(
  _currentRequests: Array<{ status: string }>,
  _previousRequests: Array<{ id: string; created_at: string }>
): number {
  // For previous period, we don't have status in our current query
  // Return 0 trend for now - in production, expand previous query to include status
  return 0;
}

function generateConversionRateSparkline(
  requests: Array<{ created_at: string; status: string }>,
  days: number
): number[] {
  const now = new Date();
  const result: number[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const dayEnd = startOfDay(subDays(now, i - 1));
    
    const dayRequests = requests.filter(item => {
      const date = new Date(item.created_at);
      return date >= dayStart && date < dayEnd;
    });
    
    const approved = dayRequests.filter(r => r.status === 'approved').length;
    const rate = dayRequests.length > 0 ? (approved / dayRequests.length) * 100 : 0;
    
    result.push(Math.round(rate));
  }
  
  return result;
}
