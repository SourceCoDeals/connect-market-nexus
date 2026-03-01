/**
 * Core query hook for Enhanced Real-Time Analytics
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCoordinates, addJitter } from "@/lib/geoCoordinates";
import { generateAnonymousName } from "@/lib/anonymousNames";
import { getCountryCode } from "@/lib/flagEmoji";

import type {
  EnhancedActiveUser,
  EnhancedRealTimeData,
  SessionRow,
  ProfileRow,
  EngagementRow,
} from "./enhanced-realtime-types";

import {
  getSessionStatus,
  calculateDuration,
  getDefaultCoordinates,
  normalizeReferrer,
  extractExternalReferrer,
  createDefaultUser,
} from "./enhanced-realtime-helpers";

export function useEnhancedRealTimeAnalytics() {
  return useQuery({
    queryKey: ['enhanced-realtime-analytics'],
    queryFn: async (): Promise<EnhancedRealTimeData> => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Fetch active sessions with profile data - include new GA4, first-touch fields, and visitor_id
      const [sessionsResult, pageViewsResult] = await Promise.all([
        supabase
          .from('user_sessions')
          .select(`
            id, session_id, user_id, visitor_id, country, country_code, city, region,
            device_type, browser, os, referrer, utm_source, user_agent,
            session_duration_seconds, last_active_at, started_at, is_active,
            ga4_client_id, first_touch_source, first_touch_medium, first_touch_campaign,
            first_touch_landing_page, first_touch_referrer, is_bot, lat, lon
          `)
          .eq('is_bot', false)  // Filter out detected bots
          .or(`last_active_at.gte.${oneHourAgo},started_at.gte.${oneHourAgo}`)
          .order('last_active_at', { ascending: false, nullsFirst: false })
          .limit(100),

        supabase
          .from('page_views')
          .select('page_path, session_id, created_at')
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      // CRITICAL FIX: Deduplicate sessions by session_id
      // The database may have duplicate rows for the same session_id
      const sessionsRaw = (sessionsResult.data || []) as unknown as SessionRow[];
      const sessionMap = new Map<string, SessionRow>();
      sessionsRaw.forEach(session => {
        // Additional client-side bot filtering for any that slip through
        // Check for outdated Chrome versions (Chrome 117-119 are 2+ years old)
        const userAgent = session.user_agent || '';
        const isLikelyBot =
          /Chrome\/11[0-9]\./.test(userAgent) ||
          /HeadlessChrome/i.test(userAgent) ||
          /bot\b/i.test(userAgent);

        if (isLikelyBot) return; // Skip bot sessions

        const existing = sessionMap.get(session.session_id);
        if (!existing) {
          sessionMap.set(session.session_id, session);
        } else if (!existing.country && session.country) {
          // Prefer the row with geo data
          sessionMap.set(session.session_id, session);
        } else if (existing.last_active_at && session.last_active_at &&
                   new Date(session.last_active_at) > new Date(existing.last_active_at)) {
          // Or prefer more recent activity
          sessionMap.set(session.session_id, session);
        }
      });
      const sessions = Array.from(sessionMap.values());
      const pageViews = pageViewsResult.data || [];

      // Get unique session IDs from page views to fetch their user_ids
      const pageViewSessionIds = [...new Set(pageViews.map(pv => pv.session_id).filter((id): id is string => id !== null))];

      // Fetch sessions for page views to get their user_ids
      let pageViewSessions: Record<string, string | null> = {};
      if (pageViewSessionIds.length > 0) {
        const { data: pvSessions, error: pvSessionsError } = await supabase
          .from('user_sessions')
          .select('session_id, user_id')
          .in('session_id', pageViewSessionIds);
        if (pvSessionsError) throw pvSessionsError;

        pageViewSessions = (pvSessions || []).reduce((acc, s) => {
          acc[s.session_id] = s.user_id;
          return acc;
        }, {} as Record<string, string | null>);
      }

      // Get all user IDs - from active sessions AND from page view sessions
      const sessionUserIds = sessions.filter(s => s.user_id).map(s => s.user_id as string);
      const pageViewUserIds = Object.values(pageViewSessions).filter(Boolean) as string[];
      const userIds = [...new Set([...sessionUserIds, ...pageViewUserIds])];

      // Fetch profiles for logged-in users with real fields
      let profiles: Record<string, ProfileRow> = {};
      if (userIds.length > 0) {
        const { data: profileData, error: profileDataError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, company, company_name, buyer_type, job_title, fee_agreement_signed, nda_signed')
          .in('id', userIds);
        if (profileDataError) throw profileDataError;

        profiles = ((profileData || []) as unknown as ProfileRow[]).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, ProfileRow>);
      }

      // Fetch engagement data for users
      let engagementData: Record<string, EngagementRow> = {};
      if (userIds.length > 0) {
        const { data: engagement, error: engagementError } = await supabase
          .from('engagement_scores')
          .select('user_id, listings_viewed, listings_saved, connections_requested, session_count, total_session_time, search_count')
          .in('user_id', userIds);
        if (engagementError) throw engagementError;

        engagementData = ((engagement || []) as unknown as EngagementRow[]).reduce((acc, e) => {
          acc[e.user_id] = e;
          return acc;
        }, {} as Record<string, EngagementRow>);
      }

      // Get current page AND build page sequence for each session
      const sessionCurrentPage: Record<string, string> = {};
      const sessionPageSequence: Record<string, string[]> = {};
      const sessionFirstPage: Record<string, string> = {};

      // Process page views in reverse chronological order to build sequences
      pageViews.forEach(pv => {
        if (pv.session_id) {
          // Track current page (most recent)
          if (!sessionCurrentPage[pv.session_id]) {
            sessionCurrentPage[pv.session_id] = pv.page_path;
          }
          // Build page sequence (will be in reverse order, we'll reverse later)
          if (!sessionPageSequence[pv.session_id]) {
            sessionPageSequence[pv.session_id] = [];
          }
          // Add to sequence if not already present (dedup consecutive same pages)
          const seq = sessionPageSequence[pv.session_id];
          if (seq.length === 0 || seq[seq.length - 1] !== pv.page_path) {
            seq.push(pv.page_path);
          }
        }
      });

      // Reverse sequences to be in chronological order, first page is the landing page
      Object.keys(sessionPageSequence).forEach(sid => {
        sessionPageSequence[sid] = sessionPageSequence[sid].reverse();
        sessionFirstPage[sid] = sessionPageSequence[sid][0] || '';
      });

      // Fetch cross-session visitor history for anonymous users
      const visitorIds = sessions
        .map(s => s.visitor_id)
        .filter(Boolean) as string[];

      const visitorHistory: Record<string, {
        totalSessions: number;
        firstSeen: string;
        totalTime: number;
      }> = {};

      if (visitorIds.length > 0) {
        const { data: historicalSessions, error: historicalSessionsError } = await supabase
          .from('user_sessions')
          .select('visitor_id, started_at, session_duration_seconds')
          .in('visitor_id', visitorIds);
        if (historicalSessionsError) throw historicalSessionsError;

        // Build visitor history map
        (historicalSessions || []).forEach(hs => {
          const vid = hs.visitor_id;
          if (!vid) return;

          if (!visitorHistory[vid]) {
            visitorHistory[vid] = {
              totalSessions: 0,
              firstSeen: hs.started_at ?? new Date().toISOString(),
              totalTime: 0,
            };
          }

          visitorHistory[vid].totalSessions++;
          visitorHistory[vid].totalTime += hs.session_duration_seconds || 0;

          // Track earliest session
          if (hs.started_at && new Date(hs.started_at) < new Date(visitorHistory[vid].firstSeen)) {
            visitorHistory[vid].firstSeen = hs.started_at;
          }
        });
      }

      // Build enhanced user objects with REAL data
      const activeUsers: EnhancedActiveUser[] = sessions.map(session => {
        const profile = session.user_id ? profiles[session.user_id] : null;
        const engagement = session.user_id ? engagementData[session.user_id] : null;
        const visitorId = session.visitor_id || null;
        const vHistory = visitorId ? visitorHistory[visitorId] : null;

        const isAnonymous = !profile;
        const realName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : null;
        const displayName = realName || generateAnonymousName(session.session_id);

        // Get coordinates - prefer stored lat/lon from IP-API, fallback to city lookup
        const storedLat = session.lat;
        const storedLon = session.lon;
        let coordinates: { lat: number; lng: number } | null = null;

        if (typeof storedLat === 'number' && typeof storedLon === 'number') {
          // Use precise coordinates from IP geolocation (stored in DB)
          coordinates = addJitter({ lat: storedLat, lng: storedLon }, session.session_id);
        } else {
          // Fallback to city/country lookup
          coordinates = getCoordinates(session.city, session.country);

          // CRITICAL FIX: Provide default coordinates for users without geo data
          // so they still appear on the globe (in Atlantic Ocean area)
          if (!coordinates) {
            coordinates = getDefaultCoordinates(session.session_id);
          } else {
            coordinates = addJitter(coordinates, session.session_id);
          }
        }

        const lastActiveAt = session.last_active_at || session.started_at;
        const sessionStatus = getSessionStatus(lastActiveAt);

        // Entry source - use first-touch if available, otherwise derive from referrer
        const entrySource = normalizeReferrer(
          session.first_touch_referrer || session.referrer,
          session.first_touch_source || session.utm_source
        );

        // Page sequence for this session
        const pageSequence = sessionPageSequence[session.session_id] || [];
        const firstPagePath = session.first_touch_landing_page || sessionFirstPage[session.session_id] || null;

        // External referrer - extract the origin from first_touch_referrer if it's external
        const externalReferrer = extractExternalReferrer(session.first_touch_referrer || session.referrer);

        return {
          sessionId: session.session_id,
          visitorId,
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
          // Entry/Attribution - NEW
          entrySource,
          firstPagePath,
          pageSequence,
          ga4ClientId: session.ga4_client_id || null,
          firstTouchSource: session.first_touch_source || null,
          firstTouchMedium: session.first_touch_medium || null,
          externalReferrer,
          // Current session
          sessionDurationSeconds: calculateDuration(session),
          lastActiveAt,
          currentPage: sessionCurrentPage[session.session_id] || null,
          sessionStatus,
          // Real engagement metrics
          listingsViewed: engagement?.listings_viewed || 0,
          listingsSaved: engagement?.listings_saved || 0,
          connectionsSent: engagement?.connections_requested || 0,
          totalVisits: vHistory?.totalSessions || engagement?.session_count || 1,
          totalTimeSpent: vHistory?.totalTime || engagement?.total_session_time || 0,
          searchCount: engagement?.search_count || 0,
          // Trust signals
          feeAgreementSigned: profile?.fee_agreement_signed || false,
          ndaSigned: profile?.nda_signed || false,
          // Cross-session journey data
          visitorFirstSeen: vHistory?.firstSeen || session.started_at,
          visitorTotalSessions: vHistory?.totalSessions || 1,
          visitorTotalTime: vHistory?.totalTime || 0,
        };
      });

      // Calculate aggregates
      const countryCounts: Record<string, { count: number; code: string | null }> = {};
      const deviceCounts: Record<string, number> = {};
      const referrerCounts: Record<string, number> = {};
      const entrySourceCounts: Record<string, number> = {};

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

        // Referrer - use improved normalizer
        const normalizedRef = normalizeReferrer(user.referrer, user.utmSource);
        referrerCounts[normalizedRef] = (referrerCounts[normalizedRef] || 0) + 1;

        // Entry source
        entrySourceCounts[user.entrySource] = (entrySourceCounts[user.entrySource] || 0) + 1;
      });

      // Recent events - look up user by session's user_id, not just active sessions
      const recentEvents = pageViews.slice(0, 30).map((pv, i) => {
        // First try to find in active users
        let matchingUser = activeUsers.find(u => u.sessionId === pv.session_id);

        // If not found but session has a user_id, create user from profile data
        if (!matchingUser && pv.session_id) {
          const userId = pageViewSessions[pv.session_id];
          if (userId && profiles[userId]) {
            const profile = profiles[userId];
            const engagement = engagementData[userId];
            const realName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

            matchingUser = {
              sessionId: pv.session_id,
              visitorId: null,
              userId,
              userName: realName || null,
              displayName: realName || generateAnonymousName(pv.session_id),
              companyName: profile.company || profile.company_name || null,
              buyerType: profile.buyer_type || null,
              jobTitle: profile.job_title || null,
              isAnonymous: !realName,
              country: null,
              countryCode: null,
              city: null,
              coordinates: null,
              deviceType: 'desktop',
              browser: null,
              os: null,
              referrer: null,
              utmSource: null,
              // Entry/Attribution
              entrySource: 'Direct',
              firstPagePath: pv.page_path,
              pageSequence: [pv.page_path],
              ga4ClientId: null,
              firstTouchSource: null,
              firstTouchMedium: null,
              externalReferrer: null,
              // Session
              sessionDurationSeconds: 0,
              lastActiveAt: pv.created_at ?? new Date().toISOString(),
              currentPage: pv.page_path ?? '',
              sessionStatus: getSessionStatus(pv.created_at),
              listingsViewed: engagement?.listings_viewed || 0,
              listingsSaved: engagement?.listings_saved || 0,
              connectionsSent: engagement?.connections_requested || 0,
              totalVisits: engagement?.session_count || 1,
              totalTimeSpent: engagement?.total_session_time || 0,
              searchCount: engagement?.search_count || 0,
              feeAgreementSigned: profile.fee_agreement_signed || false,
              ndaSigned: profile.nda_signed || false,
              // Cross-session journey data
              visitorFirstSeen: pv.created_at,
              visitorTotalSessions: 1,
              visitorTotalTime: 0,
            };
          }
        }

        return {
          id: `event-${i}`,
          type: 'page_view' as const,
          user: matchingUser || createDefaultUser(pv.session_id || `anon-${i}`, pv.page_path ?? '', pv.created_at ?? new Date().toISOString()),
          pagePath: pv.page_path ?? '',
          timestamp: pv.created_at ?? new Date().toISOString(),
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
        byEntrySource: Object.entries(entrySourceCounts)
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count),
        recentEvents,
      };
    },
    // Long staleTime ensures instant cache hits when toggling globe
    // Background refetch keeps data fresh without blocking UI
    staleTime: 30000, // 30 seconds - serve cached data instantly
    refetchInterval: 60000, // Background refresh every 60s (was 10s)
    refetchOnMount: 'always', // Always refetch on mount but use stale data immediately
  });
}
