import { format, parseISO, subDays } from "date-fns";
import type { AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";
import type { FirstSessionData } from "./types";
import {
  isDevTraffic,
  categorizeChannel,
  extractDomain,
  getDiscoverySource,
  getVisitorKey,
  selfReportedSourceToChannel,
} from "./analyticsHelpers";

/** Filter raw sessions to remove dev/bot traffic and deduplicate */
export function filterAndDeduplicateSessions(rawSessions: any[]) {
  const filtered = rawSessions.filter(s =>
    !isDevTraffic(s.referrer) &&
    !s.user_agent?.includes('Chrome/119.') &&
    !s.user_agent?.includes('Chrome/118.') &&
    !s.user_agent?.includes('Chrome/117.') &&
    !s.user_agent?.includes('HeadlessChrome')
  );

  const sessionMap = new Map<string, (typeof filtered)[0]>();
  filtered.forEach(s => {
    if (!sessionMap.has(s.session_id)) {
      sessionMap.set(s.session_id, s);
    }
  });

  return { sessions: filtered, sessionMap, uniqueSessions: Array.from(sessionMap.values()) };
}

/** Apply global filters to unique sessions */
export function applySessionFilters(
  uniqueSessions: any[],
  filters: AnalyticsFilter[],
  pageViews: any[]
): any[] {
  let result = [...uniqueSessions];

  if (filters.length > 0) {
    filters.forEach(filter => {
      if (filter.type === 'channel') {
        result = result.filter(s => {
          const discoverySource = getDiscoverySource(s);
          return categorizeChannel(discoverySource, s.utm_source, s.utm_medium) === filter.value;
        });
      }
      if (filter.type === 'referrer') {
        result = result.filter(s => {
          const discoverySource = getDiscoverySource(s);
          const domain = extractDomain(discoverySource);
          return domain === filter.value ||
                 domain.includes(filter.value) ||
                 filter.value.includes(domain);
        });
      }
      if (filter.type === 'country') result = result.filter(s => s.country === filter.value);
      if (filter.type === 'city') result = result.filter(s => s.city === filter.value);
      if (filter.type === 'region') result = result.filter(s => s.region === filter.value);
      if (filter.type === 'browser') result = result.filter(s => s.browser === filter.value);
      if (filter.type === 'os') result = result.filter(s => s.os === filter.value);
      if (filter.type === 'device') result = result.filter(s => s.device_type === filter.value);
      if (filter.type === 'campaign') result = result.filter(s => s.utm_campaign === filter.value);
      if (filter.type === 'keyword') result = result.filter(s => s.utm_term === filter.value);
    });
  }

  const pageFilter = filters.find(f => f.type === 'page');
  if (pageFilter) {
    const matchingSessionIds = new Set(
      pageViews
        .filter(pv => pv.page_path === pageFilter.value)
        .map(pv => pv.session_id)
    );
    result = result.filter(s => matchingSessionIds.has(s.session_id));
  }

  return result;
}

/** Filter profiles (signups) to match active filters */
export function filterProfiles(
  profiles: any[],
  filters: AnalyticsFilter[],
  profileToFirstSession: Map<string, FirstSessionData>
): any[] {
  if (filters.length === 0) return profiles;

  return profiles.filter(p => {
    const firstSession = profileToFirstSession.get(p.id);

    for (const filter of filters) {
      if (filter.type === 'channel') {
        if (firstSession?.original_external_referrer) {
          const channel = categorizeChannel(firstSession.original_external_referrer, firstSession.utm_source, firstSession.utm_medium);
          if (channel === filter.value) return true;
        }
        const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
        if (selfReportedChannel === filter.value) return true;
        if (firstSession) {
          const sessionChannel = categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium);
          if (sessionChannel === filter.value) return true;
        }
        return false;
      }
      if (filter.type === 'referrer') {
        if (firstSession?.original_external_referrer) {
          if (extractDomain(firstSession.original_external_referrer) === filter.value) return true;
        }
        if (firstSession) {
          if (extractDomain(firstSession.referrer) === filter.value) return true;
        }
        if (p.referral_source && p.referral_source.toLowerCase() + '.com' === filter.value) return true;
        return false;
      }
      if (filter.type === 'country') { if (firstSession?.country !== filter.value) return false; }
      if (filter.type === 'city') { if (firstSession?.city !== filter.value) return false; }
      if (filter.type === 'region') { if (firstSession?.region !== filter.value) return false; }
      if (filter.type === 'browser') { if (firstSession?.browser !== filter.value) return false; }
      if (filter.type === 'os') { if (firstSession?.os !== filter.value) return false; }
      if (filter.type === 'device') { if (firstSession?.device_type !== filter.value) return false; }
      if (filter.type === 'campaign') { if (firstSession?.utm_campaign !== filter.value) return false; }
      if (filter.type === 'keyword') { if (firstSession?.utm_term !== filter.value) return false; }
    }
    return true;
  });
}

/** Compute KPI metrics from session data */
export function computeKPIs(
  uniqueSessions: any[],
  prevSessions: any[],
  filteredConnections: any[],
  prevConnections: any[],
  filteredPageViews: any[],
  activeSessionCount: number,
  endDate: Date
) {
  // Count unique visitors
  const currentVisitorSet = new Set<string>();
  uniqueSessions.forEach(s => {
    const key = getVisitorKey(s);
    if (key) currentVisitorSet.add(key);
  });
  const currentVisitors = currentVisitorSet.size;
  const currentSessionCount = uniqueSessions.length;

  // Previous period
  const prevSessionMap = new Map<string, any>();
  prevSessions.forEach(s => {
    if (!prevSessionMap.has(s.session_id)) {
      prevSessionMap.set(s.session_id, s);
    }
  });
  const prevUniqueSessions = Array.from(prevSessionMap.values());

  const prevVisitorSet = new Set<string>();
  prevUniqueSessions.forEach(s => {
    const key = getVisitorKey(s);
    if (key) prevVisitorSet.add(key);
  });
  const prevVisitors = prevVisitorSet.size;
  const prevSessionCount = prevUniqueSessions.length;

  // Trends
  const visitorsTrend = prevVisitors > 0 ? ((currentVisitors - prevVisitors) / prevVisitors) * 100 : 0;
  const sessionsTrend = prevSessionCount > 0 ? ((currentSessionCount - prevSessionCount) / prevSessionCount) * 100 : 0;

  const currentConnections = filteredConnections.length;
  const prevConnectionsCount = prevConnections.length;
  const connectionsTrend = prevConnectionsCount > 0 ? ((currentConnections - prevConnectionsCount) / prevConnectionsCount) * 100 : 0;

  const conversionRate = currentVisitors > 0 ? (currentConnections / currentVisitors) * 100 : 0;
  const prevConversionRate = prevVisitors > 0 ? (prevConnectionsCount / prevVisitors) * 100 : 0;
  const conversionTrend = prevConversionRate > 0 ? ((conversionRate - prevConversionRate) / prevConversionRate) * 100 : 0;

  // Bounce rate
  const sessionPageCounts = new Map<string, number>();
  filteredPageViews.forEach(pv => {
    if (pv.session_id) {
      sessionPageCounts.set(pv.session_id, (sessionPageCounts.get(pv.session_id) || 0) + 1);
    }
  });
  const bouncedSessions = Array.from(sessionPageCounts.values()).filter(c => c === 1).length;
  const bounceRate = sessionPageCounts.size > 0 ? (bouncedSessions / sessionPageCounts.size) * 100 : 0;

  // Avg session time
  const sessionsWithDuration = uniqueSessions.filter(s => s.session_duration_seconds && s.session_duration_seconds > 0);
  const avgSessionTime = sessionsWithDuration.length > 0
    ? sessionsWithDuration.reduce((sum: number, s: any) => sum + (s.session_duration_seconds || 0), 0) / sessionsWithDuration.length
    : 0;

  // Sparklines (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(endDate, 6 - i), 'yyyy-MM-dd'));

  const dailyVisitorSets = new Map<string, Set<string>>();
  const dailySessionCounts = new Map<string, number>();
  const dailyConnectionCounts = new Map<string, number>();

  uniqueSessions.forEach(s => {
    try {
      const dateStr = format(parseISO(s.started_at ?? new Date().toISOString()), 'yyyy-MM-dd');
      const visitorKey = getVisitorKey(s);
      if (visitorKey) {
        if (!dailyVisitorSets.has(dateStr)) dailyVisitorSets.set(dateStr, new Set());
        dailyVisitorSets.get(dateStr)!.add(visitorKey);
      }
      dailySessionCounts.set(dateStr, (dailySessionCounts.get(dateStr) || 0) + 1);
    } catch { /* ignore parse errors */ }
  });

  filteredConnections.forEach((c: any) => {
    try {
      const dateStr = format(parseISO(c.created_at), 'yyyy-MM-dd');
      dailyConnectionCounts.set(dateStr, (dailyConnectionCounts.get(dateStr) || 0) + 1);
    } catch { /* ignore parse errors */ }
  });

  const visitorSparkline = last7Days.map(date => dailyVisitorSets.get(date)?.size || 0);
  const sessionSparkline = last7Days.map(date => dailySessionCounts.get(date) || 0);
  const connectionSparkline = last7Days.map(date => dailyConnectionCounts.get(date) || 0);

  return {
    currentVisitors,
    currentSessionCount,
    currentConnections,
    visitorsTrend,
    sessionsTrend,
    connectionsTrend,
    conversionRate,
    conversionTrend,
    bounceRate,
    avgSessionTime,
    onlineNow: activeSessionCount,
    visitorSparkline,
    sessionSparkline,
    connectionSparkline,
    dailyVisitorSets,
    dailySessionCounts,
    dailyConnectionCounts,
    last7Days,
  };
}
