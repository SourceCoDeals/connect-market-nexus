import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import type { AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";
import type { UnifiedAnalyticsData, FirstSessionData, AnalyticsSession, AnalyticsConnection, AnalyticsProfile, AnalyticsPageView, DailyMetricRow } from "./types";
import { getFirstMeaningfulSession } from "./analyticsHelpers";
import {
  filterAndDeduplicateSessions,
  applySessionFilters,
  filterProfiles,
  computeKPIs,
} from "./useSessionAnalytics";
import {
  computeChannels,
  computeReferrers,
  computeCampaigns,
  computeKeywords,
  computeGeography,
  computeTechBreakdown,
  computeFunnel,
} from "./useEventTracking";
import {
  computePages,
  computeBlogEntryPages,
  computeTopUsers,
  formatDailyMetrics,
} from "./usePageAnalytics";

// Re-export types for consumers
export type { KPIMetric, UnifiedAnalyticsData } from "./types";

export function useUnifiedAnalytics(timeRangeDays: number = 30, filters: AnalyticsFilter[] = []) {
  return useQuery({
    queryKey: ['unified-analytics', timeRangeDays, filters],
    queryFn: async (): Promise<UnifiedAnalyticsData> => {
      const endDate = new Date();
      const startDate = subDays(endDate, timeRangeDays);
      const prevStartDate = subDays(startDate, timeRangeDays);
      const startDateStr = startDate.toISOString();
      const prevStartDateStr = prevStartDate.toISOString();
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      // Fetch all data in parallel
      const [
        sessionsResult, prevSessionsResult, connectionsResult, prevConnectionsResult,
        pageViewsResult, dailyMetricsResult, activeSessionsResult,
        profilesResult, allConnectionsWithMilestonesResult,
      ] = await Promise.all([
        supabase.from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false).eq('is_production', true)
          .gte('started_at', startDateStr)
          .order('started_at', { ascending: false }).limit(1000),
        supabase.from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false).eq('is_production', true)
          .gte('started_at', prevStartDateStr).lt('started_at', startDateStr).limit(1000),
        supabase.from('connection_requests')
          .select('id, user_id, listing_id, created_at')
          .gte('created_at', startDateStr).limit(500),
        supabase.from('connection_requests')
          .select('id')
          .gte('created_at', prevStartDateStr).lt('created_at', startDateStr).limit(500),
        supabase.from('page_views')
          .select('session_id, page_path, exit_page, created_at')
          .gte('created_at', startDateStr)
          .order('created_at', { ascending: false }).limit(2000),
        supabase.from('daily_metrics')
          .select('*')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .order('date', { ascending: true }),
        supabase.from('user_sessions')
          .select('id')
          .eq('is_active', true).eq('is_bot', false).eq('is_production', true)
          .gte('last_active_at', twoMinutesAgo),
        supabase.from('profiles')
          .select('id, first_name, last_name, company, buyer_type, referral_source, referral_source_detail, created_at')
          .gte('created_at', startDateStr).limit(200),
        supabase.from('connection_requests')
          .select('id, user_id, lead_nda_signed, lead_fee_agreement_signed, created_at')
          .gte('created_at', startDateStr).limit(500),
      ]);

      const rawSessions = sessionsResult.data || [];
      const rawPrevSessions = prevSessionsResult.data || [];
      const connections = connectionsResult.data || [];
      const prevConnections = prevConnectionsResult.data || [];
      const pageViews = pageViewsResult.data || [];
      const dailyMetrics = dailyMetricsResult.data || [];
      const activeSessions = activeSessionsResult.data || [];
      const profiles = profilesResult.data || [];
      const allConnectionsWithMilestones = allConnectionsWithMilestonesResult.data || [];

      // Fetch profiles for ALL users who have sessions (for name display)
      const allUserIdsFromSessions = new Set<string>();
      rawSessions.forEach(s => { if (s.user_id) allUserIdsFromSessions.add(s.user_id); });

      let allProfilesForUsers: Array<{ id: string; first_name: string | null; last_name: string | null; company: string | null }> = [];
      if (allUserIdsFromSessions.size > 0) {
        const { data: allProfilesData, error: allProfilesError } = await supabase
          .from('profiles').select('id, first_name, last_name, company')
          .in('id', Array.from(allUserIdsFromSessions));
        if (allProfilesError) throw allProfilesError;
        allProfilesForUsers = allProfilesData || [];
      }
      const allProfilesMap = new Map(allProfilesForUsers.map(p => [p.id, p]));

      // Signup attribution: Map signups to their first session data
      const signupProfileMap = new Map<string, (typeof profiles)[0]>();
      profiles.forEach(p => signupProfileMap.set(p.id, p));
      const profileIds = profiles.map(p => p.id);

      let firstSessions: FirstSessionData[] = [];
      if (profileIds.length > 0) {
        const { data: firstSessionsData, error: firstSessionsError } = await supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, started_at, user_agent')
          .eq('is_bot', false).eq('is_production', true)
          .in('user_id', profileIds)
          .order('started_at', { ascending: true });
        if (firstSessionsError) throw firstSessionsError;
        firstSessions = firstSessionsData || [];
      }

      const profileSessionsMap = new Map<string, FirstSessionData[]>();
      firstSessions.forEach(s => {
        if (s.user_id) {
          if (!profileSessionsMap.has(s.user_id)) profileSessionsMap.set(s.user_id, []);
          profileSessionsMap.get(s.user_id)!.push(s);
        }
      });

      const profileToFirstSession = new Map<string, FirstSessionData>();
      profileSessionsMap.forEach((sessions, userId) => {
        const meaningfulSession = getFirstMeaningfulSession(sessions.reverse());
        if (meaningfulSession) profileToFirstSession.set(userId, meaningfulSession as FirstSessionData);
      });

      // Build self-reported sources
      const selfReportedSourceMap: Record<string, { signups: number; connections: number; keywords: string[] }> = {};
      profiles.forEach(p => {
        if (p.referral_source) {
          const source = p.referral_source.toLowerCase().trim();
          if (!selfReportedSourceMap[source]) selfReportedSourceMap[source] = { signups: 0, connections: 0, keywords: [] };
          selfReportedSourceMap[source].signups++;
          if (p.referral_source_detail) selfReportedSourceMap[source].keywords.push(p.referral_source_detail);
        }
      });
      allConnectionsWithMilestones.forEach(c => {
        if (c.user_id) {
          const profile = signupProfileMap.get(c.user_id);
          if (profile?.referral_source) {
            const source = profile.referral_source.toLowerCase().trim();
            if (selfReportedSourceMap[source]) selfReportedSourceMap[source].connections++;
          }
        }
      });
      const selfReportedSources = Object.entries(selfReportedSourceMap)
        .map(([source, data]) => ({
          source: source.charAt(0).toUpperCase() + source.slice(1),
          ...data,
          keywords: [...new Set(data.keywords)].slice(0, 5),
        }))
        .sort((a, b) => b.signups - a.signups);

      // Filter sessions
      const { sessionMap: currentSessionMap } = filterAndDeduplicateSessions(rawSessions);
      const { sessions: prevFilteredSessions } = filterAndDeduplicateSessions(rawPrevSessions as AnalyticsSession[]);
      let { uniqueSessions } = filterAndDeduplicateSessions(rawSessions);
      uniqueSessions = applySessionFilters(uniqueSessions, filters, pageViews);

      // Filter propagation
      const filteredSessionIds = new Set(uniqueSessions.map(s => s.session_id));
      const filteredUserIds = new Set<string>(uniqueSessions.filter(s => s.user_id).map(s => s.user_id as string));
      const filteredPageViews = filters.length > 0
        ? pageViews.filter(pv => pv.session_id && filteredSessionIds.has(pv.session_id)) : pageViews;
      const filteredConnections = filters.length > 0
        ? connections.filter(c => c.user_id && filteredUserIds.has(c.user_id)) : connections;
      const filteredConnectionsWithMilestones = filters.length > 0
        ? allConnectionsWithMilestones.filter(c => c.user_id && filteredUserIds.has(c.user_id)) : allConnectionsWithMilestones;
      const filteredProfiles = filterProfiles(profiles, filters, profileToFirstSession);

      // Smart attribution for connection users
      const connectionUserIds = new Set<string>();
      filteredConnections.forEach(c => { if (c.user_id) connectionUserIds.add(c.user_id); });

      type ConnectionSessionType = (typeof rawSessions)[0];
      let connectionUserSessions: ConnectionSessionType[] = [];
      if (connectionUserIds.size > 0) {
        const { data, error: sessionError } = await supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false).eq('is_production', true)
          .in('user_id', Array.from(connectionUserIds))
          .order('started_at', { ascending: false });
        if (sessionError) throw sessionError;
        connectionUserSessions = (data || []) as ConnectionSessionType[];
      }

      const userSessionGroups = new Map<string, ConnectionSessionType[]>();
      connectionUserSessions.forEach(s => {
        if (s.user_id) {
          if (!userSessionGroups.has(s.user_id)) userSessionGroups.set(s.user_id, []);
          userSessionGroups.get(s.user_id)!.push(s);
        }
      });

      const userToAttributionSession = new Map<string, ConnectionSessionType>();
      userSessionGroups.forEach((sessions, userId) => {
        const best = getFirstMeaningfulSession(sessions);
        if (best) userToAttributionSession.set(userId, best as ConnectionSessionType);
      });

      // Compute all analytics sections
      const typedFilteredConnections = filteredConnections as unknown as AnalyticsConnection[];
      const typedPrevConnections = prevConnections as unknown as AnalyticsConnection[];
      const typedFilteredProfiles = filteredProfiles as unknown as AnalyticsProfile[];
      const typedFilteredConnectionsWithMilestones = filteredConnectionsWithMilestones as unknown as AnalyticsConnection[];
      const typedUserToAttributionSession = userToAttributionSession as unknown as Map<string, AnalyticsSession>;
      const typedAllProfilesMap = allProfilesMap as unknown as Map<string, AnalyticsProfile>;
      const typedDailyMetrics = dailyMetrics as unknown as DailyMetricRow[];

      const kpiData = computeKPIs(uniqueSessions, prevFilteredSessions, typedFilteredConnections, typedPrevConnections, filteredPageViews, activeSessions.length, endDate);
      const channels = computeChannels(uniqueSessions, typedFilteredConnections, typedFilteredProfiles, profileToFirstSession, typedUserToAttributionSession);
      const referrers = computeReferrers(uniqueSessions, typedFilteredConnections, typedFilteredProfiles, profileToFirstSession, typedUserToAttributionSession);
      const campaigns = computeCampaigns(uniqueSessions, typedFilteredConnections, typedFilteredProfiles, profileToFirstSession, typedUserToAttributionSession);
      const keywords = computeKeywords(uniqueSessions, typedFilteredConnections, typedFilteredProfiles, profileToFirstSession, typedUserToAttributionSession);
      const { countries, regions, cities, geoCoverage } = computeGeography(uniqueSessions, typedFilteredConnections, typedFilteredProfiles, profileToFirstSession, typedUserToAttributionSession);
      const { browsers, operatingSystems, devices } = computeTechBreakdown(uniqueSessions, typedFilteredProfiles, profileToFirstSession, kpiData.currentVisitors);
      const funnel = computeFunnel(kpiData.currentVisitors, uniqueSessions, filteredPageViews, typedFilteredConnections, typedFilteredConnectionsWithMilestones, kpiData.conversionRate);
      const { topPages, entryPages, exitPages } = computePages(filteredPageViews);
      const blogEntryPages = computeBlogEntryPages(uniqueSessions);
      const topUsers = computeTopUsers(uniqueSessions, typedFilteredConnectionsWithMilestones, filteredPageViews, currentSessionMap, typedAllProfilesMap, filters, kpiData.last7Days);
      const formattedDailyMetrics = formatDailyMetrics(filters, typedDailyMetrics, kpiData.dailyVisitorSets, kpiData.dailySessionCounts, kpiData.dailyConnectionCounts, startDate, endDate);

      return {
        kpis: {
          visitors: { value: kpiData.currentVisitors, trend: kpiData.visitorsTrend, sparkline: kpiData.visitorSparkline },
          sessions: { value: kpiData.currentSessionCount, trend: kpiData.sessionsTrend, sparkline: kpiData.sessionSparkline },
          connections: { value: kpiData.currentConnections, trend: kpiData.connectionsTrend, sparkline: kpiData.connectionSparkline },
          conversionRate: { value: kpiData.conversionRate, trend: kpiData.conversionTrend },
          bounceRate: { value: kpiData.bounceRate, trend: 0 },
          avgSessionTime: { value: kpiData.avgSessionTime, trend: 0 },
          onlineNow: kpiData.onlineNow,
        },
        dailyMetrics: formattedDailyMetrics,
        channels,
        referrers,
        campaigns,
        keywords,
        selfReportedSources,
        countries,
        regions,
        cities,
        geoCoverage,
        topPages,
        entryPages,
        exitPages,
        blogEntryPages,
        browsers,
        operatingSystems,
        devices,
        funnel,
        topUsers,
      };
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
