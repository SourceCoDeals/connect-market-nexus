import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealTimeAnalyticsData {
  // Active users right now
  activeUsers: number;
  activeUsersList: Array<{
    sessionId: string;
    userId: string | null;
    country: string | null;
    city: string | null;
    lastActiveAt: string;
    durationSeconds: number;
  }>;
  
  // Current pages being viewed
  currentPages: Array<{
    pagePath: string;
    viewCount: number;
    uniqueSessions: number;
  }>;
  
  // Geographic distribution of active users
  activeByCountry: Array<{
    country: string;
    count: number;
  }>;
  
  // Active session duration distribution
  durationDistribution: {
    under1min: number;
    oneToFive: number;
    fiveToFifteen: number;
    over15min: number;
  };
  
  // Real-time activity feed
  recentEvents: Array<{
    type: string;
    sessionId: string;
    pagePath?: string;
    timestamp: string;
    country?: string;
  }>;
}

export function useRealTimeAnalytics() {
  return useQuery({
    queryKey: ['realtime-analytics'],
    queryFn: async (): Promise<RealTimeAnalyticsData> => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Fetch active sessions (heartbeat within last 2 minutes) - filter out bots
      const [activeSessionsResult, currentPagesResult] = await Promise.all([
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, country, city, last_active_at, session_duration_seconds, started_at, lat, lon')
          .eq('is_active', true)
          .eq('is_bot', false)  // Filter out detected bots
          .gte('last_active_at', twoMinutesAgo)
          .order('last_active_at', { ascending: false })
          .limit(100),
        
        supabase
          .from('page_views')
          .select('page_path, session_id')
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      
      const activeSessions = activeSessionsResult.data || [];
      const recentPages = currentPagesResult.data || [];
      
      // Format active users list
      const activeUsersList = activeSessions.map(s => ({
        sessionId: s.session_id,
        userId: s.user_id,
        country: s.country,
        city: s.city,
        lastActiveAt: s.last_active_at || s.started_at,
        durationSeconds: s.session_duration_seconds || 0,
      }));
      
      // Aggregate current pages
      const pageStats: Record<string, { count: number; sessions: Set<string> }> = {};
      recentPages.forEach(pv => {
        if (!pageStats[pv.page_path]) {
          pageStats[pv.page_path] = { count: 0, sessions: new Set() };
        }
        pageStats[pv.page_path].count += 1;
        if (pv.session_id) {
          pageStats[pv.page_path].sessions.add(pv.session_id);
        }
      });
      
      const currentPages = Object.entries(pageStats)
        .map(([pagePath, stats]) => ({
          pagePath: formatPagePath(pagePath),
          viewCount: stats.count,
          uniqueSessions: stats.sessions.size,
        }))
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10);
      
      // Geographic distribution of active users
      const countryCounts: Record<string, number> = {};
      activeSessions.forEach(s => {
        const country = s.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });
      
      const activeByCountry = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);
      
      // Duration distribution
      const durationDistribution = {
        under1min: 0,
        oneToFive: 0,
        fiveToFifteen: 0,
        over15min: 0,
      };
      
      activeSessions.forEach(s => {
        const duration = s.session_duration_seconds || 0;
        if (duration < 60) durationDistribution.under1min++;
        else if (duration < 300) durationDistribution.oneToFive++;
        else if (duration < 900) durationDistribution.fiveToFifteen++;
        else durationDistribution.over15min++;
      });
      
      // Recent events
      const recentEvents = recentPages.slice(0, 20).map(pv => ({
        type: 'page_view',
        sessionId: pv.session_id || '',
        pagePath: pv.page_path,
        timestamp: new Date().toISOString(), // Approximate
        country: activeSessions.find(s => s.session_id === pv.session_id)?.country || undefined,
      }));
      
      return {
        activeUsers: activeSessions.length,
        activeUsersList,
        currentPages,
        activeByCountry,
        durationDistribution,
        recentEvents,
      };
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

function formatPagePath(path: string): string {
  if (!path || path === '/') return 'Home';
  
  // Clean up and format path
  const cleaned = path.replace(/^\//, '').split('/')[0];
  
  const pathNames: Record<string, string> = {
    'marketplace': 'Marketplace',
    'listing': 'Listing Detail',
    'search': 'Search',
    'admin': 'Admin',
    'dashboard': 'Dashboard',
    'profile': 'Profile',
    'settings': 'Settings',
    'saved': 'Saved Listings',
  };
  
  return pathNames[cleaned] || cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
