import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

export interface ListingHealthData {
  // Health scores
  healthScores: Array<{
    id: string;
    title: string;
    category: string;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
    views: number;
    saves: number;
    requests: number;
    daysActive: number;
    viewToSaveRate: number;
    issues: string[];
  }>;
  
  // Stale listings alert
  staleListings: Array<{
    id: string;
    title: string;
    daysActive: number;
    views: number;
    lastActivity: string;
  }>;
  
  // Health distribution
  healthDistribution: {
    healthy: number;
    warning: number;
    critical: number;
  };
  
  // Category health averages
  categoryHealth: Array<{
    category: string;
    avgHealthScore: number;
    listingCount: number;
  }>;
  
  // Time to first engagement
  timeToFirstEngagement: {
    avgDaysToFirstView: number;
    avgDaysToFirstSave: number;
    avgDaysToFirstRequest: number;
  };
}

export function useListingHealth() {
  return useQuery({
    queryKey: ['listing-health'],
    queryFn: async (): Promise<ListingHealthData> => {
      const now = new Date();
      
      // Fetch all active listings
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, title, category, created_at, status')
        .eq('status', 'active');
      
      if (listingsError) throw listingsError;
      
      // Fetch analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from('listing_analytics')
        .select('listing_id, action_type, created_at');
      
      if (analyticsError) throw analyticsError;
      
      // Fetch saves
      const { data: saves, error: savesError } = await supabase
        .from('saved_listings')
        .select('listing_id, created_at');
      
      if (savesError) throw savesError;
      
      // Fetch connection requests
      const { data: requests, error: requestsError } = await supabase
        .from('connection_requests')
        .select('listing_id, created_at');
      
      if (requestsError) throw requestsError;
      
      const listingsData = listings || [];
      const analyticsData = analytics || [];
      const savesData = saves || [];
      const requestsData = requests || [];
      
      // Aggregate metrics per listing
      const viewCounts: Record<string, number> = {};
      const firstView: Record<string, Date> = {};
      const lastActivity: Record<string, Date> = {};
      
      analyticsData.forEach(a => {
        if (a.action_type === 'view' && a.listing_id) {
          viewCounts[a.listing_id] = (viewCounts[a.listing_id] || 0) + 1;
          
          const date = new Date(a.created_at);
          if (!firstView[a.listing_id] || date < firstView[a.listing_id]) {
            firstView[a.listing_id] = date;
          }
          if (!lastActivity[a.listing_id] || date > lastActivity[a.listing_id]) {
            lastActivity[a.listing_id] = date;
          }
        }
      });
      
      const saveCounts: Record<string, number> = {};
      const firstSave: Record<string, Date> = {};
      
      savesData.forEach(s => {
        if (s.listing_id) {
          saveCounts[s.listing_id] = (saveCounts[s.listing_id] || 0) + 1;
          
          const date = new Date(s.created_at);
          if (!firstSave[s.listing_id] || date < firstSave[s.listing_id]) {
            firstSave[s.listing_id] = date;
          }
          if (!lastActivity[s.listing_id] || date > lastActivity[s.listing_id]) {
            lastActivity[s.listing_id] = date;
          }
        }
      });
      
      const requestCounts: Record<string, number> = {};
      const firstRequest: Record<string, Date> = {};
      
      requestsData.forEach(r => {
        if (r.listing_id) {
          requestCounts[r.listing_id] = (requestCounts[r.listing_id] || 0) + 1;
          
          const date = new Date(r.created_at);
          if (!firstRequest[r.listing_id] || date < firstRequest[r.listing_id]) {
            firstRequest[r.listing_id] = date;
          }
          if (!lastActivity[r.listing_id] || date > lastActivity[r.listing_id]) {
            lastActivity[r.listing_id] = date;
          }
        }
      });
      
      // Calculate health scores
      const healthScores = listingsData.map(listing => {
        const views = viewCounts[listing.id] || 0;
        const saves = saveCounts[listing.id] || 0;
        const reqs = requestCounts[listing.id] || 0;
        const createdAt = new Date(listing.created_at);
        const daysActive = Math.max(1, differenceInDays(now, createdAt));
        
        // Calculate view-to-save rate
        const viewToSaveRate = views > 0 ? (saves / views) * 100 : 0;
        
        // Health score formula: (views * 0.2 + saves * 2 + requests * 5) / sqrt(daysActive)
        const rawScore = (views * 0.2 + saves * 2 + reqs * 5) / Math.sqrt(daysActive);
        const healthScore = Math.min(100, Math.round(rawScore * 10)); // Normalize to 0-100
        
        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        const issues: string[] = [];
        
        if (daysActive > 14 && views < 10) {
          issues.push('Low visibility: less than 10 views in 14+ days');
          healthStatus = 'warning';
        }
        if (daysActive > 14 && saves === 0) {
          issues.push('No saves after 14+ days');
          healthStatus = 'warning';
        }
        if (views > 20 && viewToSaveRate < 2) {
          issues.push('Low save rate: below 2%');
          healthStatus = healthStatus === 'warning' ? 'critical' : 'warning';
        }
        if (daysActive > 30 && reqs === 0) {
          issues.push('No connection requests after 30+ days');
          healthStatus = 'critical';
        }
        
        if (healthScore < 10 && daysActive > 7) {
          healthStatus = 'critical';
        } else if (healthScore < 25 && daysActive > 7) {
          healthStatus = healthStatus === 'healthy' ? 'warning' : healthStatus;
        }
        
        return {
          id: listing.id,
          title: listing.title,
          category: listing.category || 'Uncategorized',
          healthScore,
          healthStatus,
          views,
          saves,
          requests: reqs,
          daysActive,
          viewToSaveRate,
          issues,
        };
      }).sort((a, b) => a.healthScore - b.healthScore);
      
      // Stale listings (views > 10, saves = 0, age > 14 days)
      const staleListings = healthScores
        .filter(l => l.views > 10 && l.saves === 0 && l.daysActive > 14)
        .map(l => ({
          id: l.id,
          title: l.title,
          daysActive: l.daysActive,
          views: l.views,
          lastActivity: lastActivity[l.id]?.toISOString() || 'Never',
        }))
        .slice(0, 10);
      
      // Health distribution
      const healthDistribution = {
        healthy: healthScores.filter(l => l.healthStatus === 'healthy').length,
        warning: healthScores.filter(l => l.healthStatus === 'warning').length,
        critical: healthScores.filter(l => l.healthStatus === 'critical').length,
      };
      
      // Category health averages
      const categoryScores: Record<string, number[]> = {};
      healthScores.forEach(l => {
        if (!categoryScores[l.category]) {
          categoryScores[l.category] = [];
        }
        categoryScores[l.category].push(l.healthScore);
      });
      
      const categoryHealth = Object.entries(categoryScores)
        .map(([category, scores]) => ({
          category,
          avgHealthScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          listingCount: scores.length,
        }))
        .sort((a, b) => b.avgHealthScore - a.avgHealthScore);
      
      // Time to first engagement
      const daysToView: number[] = [];
      const daysToSave: number[] = [];
      const daysToRequest: number[] = [];
      
      listingsData.forEach(l => {
        const created = new Date(l.created_at);
        
        if (firstView[l.id]) {
          daysToView.push(differenceInDays(firstView[l.id], created));
        }
        if (firstSave[l.id]) {
          daysToSave.push(differenceInDays(firstSave[l.id], created));
        }
        if (firstRequest[l.id]) {
          daysToRequest.push(differenceInDays(firstRequest[l.id], created));
        }
      });
      
      const timeToFirstEngagement = {
        avgDaysToFirstView: daysToView.length > 0
          ? Math.round(daysToView.reduce((a, b) => a + b, 0) / daysToView.length * 10) / 10
          : 0,
        avgDaysToFirstSave: daysToSave.length > 0
          ? Math.round(daysToSave.reduce((a, b) => a + b, 0) / daysToSave.length * 10) / 10
          : 0,
        avgDaysToFirstRequest: daysToRequest.length > 0
          ? Math.round(daysToRequest.reduce((a, b) => a + b, 0) / daysToRequest.length * 10) / 10
          : 0,
      };
      
      return {
        healthScores,
        staleListings,
        healthDistribution,
        categoryHealth,
        timeToFirstEngagement,
      };
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });
}
