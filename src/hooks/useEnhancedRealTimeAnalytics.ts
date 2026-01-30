import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCoordinates, addJitter } from "@/lib/geoCoordinates";
import { generateAnonymousName } from "@/lib/anonymousNames";
import { getCountryCode } from "@/lib/flagEmoji";

export interface EnhancedActiveUser {
  // Identity - REAL DATA
  sessionId: string;
  userId: string | null;
  userName: string | null;
  displayName: string;
  companyName: string | null;
  buyerType: string | null;
  jobTitle: string | null;
  isAnonymous: boolean;
  
  // Location
  country: string | null;
  countryCode: string | null;
  city: string | null;
  coordinates: { lat: number; lng: number } | null;
  
  // Tech Stack
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string | null;
  os: string | null;
  
  // Traffic Source
  referrer: string | null;
  utmSource: string | null;
  
  // Current Session
  sessionDurationSeconds: number;
  lastActiveAt: string;
  currentPage: string | null;
  
  // Real Engagement Metrics
  listingsViewed: number;
  listingsSaved: number;
  connectionsSent: number;
  totalVisits: number;
  totalTimeSpent: number;
  searchCount: number;
  
  // Trust Signals
  feeAgreementSigned: boolean;
  ndaSigned: boolean;
}

export interface EnhancedRealTimeData {
  activeUsers: EnhancedActiveUser[];
  totalActiveUsers: number;
  
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
      
      // Fetch profiles for logged-in users with real fields
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, company, company_name, buyer_type, job_title, fee_agreement_signed, nda_signed')
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
          .select('user_id, listings_viewed, listings_saved, connections_requested, session_count, total_session_time, search_count')
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
      
      // Build enhanced user objects with REAL data
      const activeUsers: EnhancedActiveUser[] = sessions.map(session => {
        const profile = session.user_id ? profiles[session.user_id] : null;
        const engagement = session.user_id ? engagementData[session.user_id] : null;
        
        const isAnonymous = !profile;
        const realName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : null;
        const displayName = realName || generateAnonymousName(session.session_id);
        
        // Get coordinates
        let coordinates = getCoordinates(session.city, session.country);
        if (coordinates) {
          coordinates = addJitter(coordinates, session.session_id);
        }
        
        return {
          sessionId: session.session_id,
          userId: session.user_id,
          userName: realName,
          displayName,
          companyName: profile?.company || profile?.company_name || null,
          buyerType: profile?.buyer_type || null,
          jobTitle: profile?.job_title || null,
          isAnonymous,
          country: session.country,
          countryCode: session.country_code || getCountryCode(session.country),
          city: session.city,
          coordinates,
          deviceType: (session.device_type as 'mobile' | 'desktop' | 'tablet') || 'desktop',
          browser: session.browser,
          os: session.os,
          referrer: session.referrer,
          utmSource: session.utm_source,
          sessionDurationSeconds: session.session_duration_seconds || 0,
          lastActiveAt: session.last_active_at || session.started_at,
          currentPage: sessionCurrentPage[session.session_id] || null,
          // Real engagement metrics
          listingsViewed: engagement?.listings_viewed || 0,
          listingsSaved: engagement?.listings_saved || 0,
          connectionsSent: engagement?.connections_requested || 0,
          totalVisits: engagement?.session_count || 1,
          totalTimeSpent: engagement?.total_session_time || 0,
          searchCount: engagement?.search_count || 0,
          // Trust signals
          feeAgreementSigned: profile?.fee_agreement_signed || false,
          ndaSigned: profile?.nda_signed || false,
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
          user: matchingUser || createDefaultUser(pv.session_id || `anon-${i}`, pv.page_path, pv.created_at),
          pagePath: pv.page_path,
          timestamp: pv.created_at,
        };
      });
      
      return {
        activeUsers,
        totalActiveUsers: activeUsers.length,
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
    refetchInterval: 10000,
  });
}

function createDefaultUser(sessionId: string, pagePath: string | null, timestamp: string): EnhancedActiveUser {
  return {
    sessionId,
    userId: null,
    userName: null,
    displayName: generateAnonymousName(sessionId),
    companyName: null,
    buyerType: null,
    jobTitle: null,
    isAnonymous: true,
    country: null,
    countryCode: null,
    city: null,
    coordinates: null,
    deviceType: 'desktop',
    browser: null,
    os: null,
    referrer: null,
    utmSource: null,
    sessionDurationSeconds: 0,
    lastActiveAt: timestamp,
    currentPage: pagePath,
    listingsViewed: 0,
    listingsSaved: 0,
    connectionsSent: 0,
    totalVisits: 1,
    totalTimeSpent: 0,
    searchCount: 0,
    feeAgreementSigned: false,
    ndaSigned: false,
  };
}
