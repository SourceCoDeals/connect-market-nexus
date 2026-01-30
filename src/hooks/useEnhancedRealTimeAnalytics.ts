import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCoordinates, addJitter } from "@/lib/geoCoordinates";
import { generateAnonymousName } from "@/lib/anonymousNames";
import { getCountryCode } from "@/lib/flagEmoji";

export interface EnhancedActiveUser {
  // Session data
  sessionId: string;
  userId: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  
  // Device/Tech data
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string | null;
  os: string | null;
  
  // Traffic source
  referrer: string | null;
  utmSource: string | null;
  
  // Timing
  sessionDurationSeconds: number;
  lastActiveAt: string;
  currentPage: string | null;
  
  // User profile (if logged in)
  userName: string | null;
  displayName: string; // Either real name or anonymous name
  companyName: string | null;
  buyerType: string | null;
  isAnonymous: boolean;
  
  // Intelligence metrics (calculated)
  conversionLikelihood: number;
  conversionVsAvg: number; // percentage vs average
  estimatedValue: number;
  totalVisits: number;
  
  // Geographic coordinates for map
  coordinates: { lat: number; lng: number } | null;
}

export interface EnhancedRealTimeData {
  activeUsers: EnhancedActiveUser[];
  totalActiveUsers: number;
  totalEstimatedValue: number;
  
  // Aggregates for summary panel
  byCountry: Array<{ country: string; countryCode: string | null; count: number }>;
  byDevice: Array<{ device: string; count: number }>;
  byReferrer: Array<{ referrer: string; count: number }>;
  
  // Recent activity events
  recentEvents: Array<{
    id: string;
    type: 'page_view' | 'save' | 'connection_request';
    user: EnhancedActiveUser;
    pagePath?: string;
    listingTitle?: string;
    timestamp: string;
  }>;
}

// Calculate conversion likelihood based on engagement
function calculateConversion(data: {
  listingViews: number;
  savedListings: number;
  connectionRequests: number;
  sessionCount: number;
}): { score: number; vsAvg: number } {
  let score = 0;
  
  // Engagement signals
  score += Math.min(data.listingViews / 10 * 25, 25);
  score += Math.min(data.savedListings / 5 * 30, 30);
  score += Math.min(data.connectionRequests * 15, 30);
  score += Math.min(data.sessionCount / 10 * 15, 15);
  
  // Compare to average (50) and express as percentage vs avg
  const avgScore = 50;
  const vsAvg = Math.round(((score - avgScore) / avgScore) * 100);
  
  return { score: Math.round(score), vsAvg };
}

// Calculate estimated value based on buyer type and engagement
function calculateEstimatedValue(buyerType: string | null, conversionScore: number): number {
  const baseValues: Record<string, number> = {
    'privateEquity': 5.00,
    'familyOffice': 4.00,
    'corporate': 3.50,
    'searchFund': 2.50,
    'independentSponsor': 3.00,
    'individual': 1.50,
  };
  
  const base = baseValues[buyerType || ''] || 0.50;
  
  // Multiply by engagement level
  const engagementMultiplier = 
    conversionScore > 70 ? 2.0 :
    conversionScore > 50 ? 1.5 :
    conversionScore > 30 ? 1.0 : 0.5;
  
  return Math.round(base * engagementMultiplier * 100) / 100;
}

export function useEnhancedRealTimeAnalytics() {
  return useQuery({
    queryKey: ['enhanced-realtime-analytics'],
    queryFn: async (): Promise<EnhancedRealTimeData> => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Fetch active sessions with profile data
      const [sessionsResult, pageViewsResult] = await Promise.all([
        supabase
          .from('user_sessions')
          .select(`
            id, session_id, user_id, country, country_code, city, region,
            device_type, browser, os, referrer, utm_source,
            session_duration_seconds, last_active_at, started_at
          `)
          .eq('is_active', true)
          .gte('last_active_at', twoMinutesAgo)
          .order('last_active_at', { ascending: false })
          .limit(100),
        
        supabase
          .from('page_views')
          .select('page_path, session_id, created_at')
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      
      const sessions = sessionsResult.data || [];
      const pageViews = pageViewsResult.data || [];
      
      // Get user IDs to fetch profiles
      const userIds = sessions
        .filter(s => s.user_id)
        .map(s => s.user_id as string);
      
      // Fetch profiles for logged-in users
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, company_name, buyer_type')
          .in('id', userIds);
        
        profiles = (profileData || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
      
      // Fetch engagement data for users
      let engagementData: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: engagement } = await supabase
          .from('engagement_scores')
          .select('user_id, listings_viewed, listings_saved, connections_requested, session_count')
          .in('user_id', userIds);
        
        engagementData = (engagement || []).reduce((acc, e) => {
          acc[e.user_id] = e;
          return acc;
        }, {} as Record<string, any>);
      }
      
      // Get current page for each session
      const sessionCurrentPage: Record<string, string> = {};
      pageViews.forEach(pv => {
        if (pv.session_id && !sessionCurrentPage[pv.session_id]) {
          sessionCurrentPage[pv.session_id] = pv.page_path;
        }
      });
      
      // Build enhanced user objects
      const activeUsers: EnhancedActiveUser[] = sessions.map(session => {
        const profile = session.user_id ? profiles[session.user_id] : null;
        const engagement = session.user_id ? engagementData[session.user_id] : null;
        
        const isAnonymous = !profile;
        const displayName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
          : generateAnonymousName(session.session_id);
        
        const conversionData = calculateConversion({
          listingViews: engagement?.listings_viewed || 0,
          savedListings: engagement?.listings_saved || 0,
          connectionRequests: engagement?.connections_requested || 0,
          sessionCount: engagement?.session_count || 1,
        });
        
        const buyerType = profile?.buyer_type || null;
        const estimatedValue = calculateEstimatedValue(buyerType, conversionData.score);
        
        // Get coordinates
        let coordinates = getCoordinates(session.city, session.country);
        if (coordinates) {
          coordinates = addJitter(coordinates, session.session_id);
        }
        
        return {
          sessionId: session.session_id,
          userId: session.user_id,
          country: session.country,
          countryCode: session.country_code || getCountryCode(session.country),
          city: session.city,
          deviceType: (session.device_type as 'mobile' | 'desktop' | 'tablet') || 'desktop',
          browser: session.browser,
          os: session.os,
          referrer: session.referrer,
          utmSource: session.utm_source,
          sessionDurationSeconds: session.session_duration_seconds || 0,
          lastActiveAt: session.last_active_at || session.started_at,
          currentPage: sessionCurrentPage[session.session_id] || null,
          userName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
          displayName,
          companyName: profile?.company_name || null,
          buyerType,
          isAnonymous,
          conversionLikelihood: conversionData.score,
          conversionVsAvg: conversionData.vsAvg,
          estimatedValue,
          totalVisits: engagement?.session_count || 1,
          coordinates,
        };
      });
      
      // Calculate aggregates
      const countryCounts: Record<string, { count: number; code: string | null }> = {};
      const deviceCounts: Record<string, number> = {};
      const referrerCounts: Record<string, number> = {};
      
      activeUsers.forEach(user => {
        // Country
        const country = user.country || 'Unknown';
        if (!countryCounts[country]) {
          countryCounts[country] = { count: 0, code: user.countryCode };
        }
        countryCounts[country].count++;
        
        // Device
        const device = user.deviceType || 'unknown';
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
        
        // Referrer
        const referrer = user.referrer || user.utmSource || 'Direct';
        const normalizedReferrer = referrer.includes('google') ? 'Google' :
          referrer.includes('facebook') ? 'Facebook' :
          referrer.includes('linkedin') ? 'LinkedIn' :
          referrer.includes('twitter') ? 'Twitter' :
          referrer === 'Direct' ? 'Direct' : 'Other';
        referrerCounts[normalizedReferrer] = (referrerCounts[normalizedReferrer] || 0) + 1;
      });
      
      // Recent events
      const recentEvents = pageViews.slice(0, 20).map((pv, i) => {
        const matchingUser = activeUsers.find(u => u.sessionId === pv.session_id);
        return {
          id: `event-${i}`,
          type: 'page_view' as const,
          user: matchingUser || {
            sessionId: pv.session_id || '',
            userId: null,
            country: null,
            countryCode: null,
            city: null,
            deviceType: 'desktop' as const,
            browser: null,
            os: null,
            referrer: null,
            utmSource: null,
            sessionDurationSeconds: 0,
            lastActiveAt: pv.created_at,
            currentPage: pv.page_path,
            userName: null,
            displayName: generateAnonymousName(pv.session_id || `anon-${i}`),
            companyName: null,
            buyerType: null,
            isAnonymous: true,
            conversionLikelihood: 20,
            conversionVsAvg: -60,
            estimatedValue: 0.25,
            totalVisits: 1,
            coordinates: null,
          },
          pagePath: pv.page_path,
          timestamp: pv.created_at,
        };
      });
      
      return {
        activeUsers,
        totalActiveUsers: activeUsers.length,
        totalEstimatedValue: activeUsers.reduce((sum, u) => sum + u.estimatedValue, 0),
        byCountry: Object.entries(countryCounts)
          .map(([country, data]) => ({ country, countryCode: data.code, count: data.count }))
          .sort((a, b) => b.count - a.count),
        byDevice: Object.entries(deviceCounts)
          .map(([device, count]) => ({ device, count }))
          .sort((a, b) => b.count - a.count),
        byReferrer: Object.entries(referrerCounts)
          .map(([referrer, count]) => ({ referrer, count }))
          .sort((a, b) => b.count - a.count),
        recentEvents,
      };
    },
    staleTime: 5000,
    refetchInterval: 10000, // Refresh every 10 seconds for real-time feel
  });
}
