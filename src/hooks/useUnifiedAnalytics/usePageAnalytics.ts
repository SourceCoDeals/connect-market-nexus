import { format, parseISO } from "date-fns";
import type { AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";
import type { AnalyticsSession, AnalyticsConnection, AnalyticsPageView, AnalyticsProfile, DailyMetricRow } from "./types";
import {
  categorizeChannel,
  extractDomain,
  getVisitorKey,
  generateAnimalName,
} from "./analyticsHelpers";

/** Compute page breakdown: topPages, entryPages, exitPages */
export function computePages(filteredPageViews: AnalyticsPageView[]) {
  const pageCounts: Record<string, { visitors: number; views: number }> = {};
  const entryPageCounts: Record<string, { visitors: number; bounces: number }> = {};
  const exitPageCounts: Record<string, number> = {};

  const sessionPages: Record<string, typeof filteredPageViews> = {};
  filteredPageViews.forEach(pv => {
    if (pv.session_id) {
      if (!sessionPages[pv.session_id]) sessionPages[pv.session_id] = [];
      sessionPages[pv.session_id].push(pv);
    }
    if (!pageCounts[pv.page_path]) pageCounts[pv.page_path] = { visitors: 0, views: 0 };
    pageCounts[pv.page_path].views++;
    if (pv.exit_page) {
      exitPageCounts[pv.page_path] = (exitPageCounts[pv.page_path] || 0) + 1;
    }
  });

  Object.entries(sessionPages).forEach(([_sessionId, pages]) => {
    const sortedPages = pages.sort((a, b) =>
      new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    if (sortedPages.length > 0) {
      const entryPage = sortedPages[0].page_path;
      if (!entryPageCounts[entryPage]) entryPageCounts[entryPage] = { visitors: 0, bounces: 0 };
      entryPageCounts[entryPage].visitors++;
      if (sortedPages.length === 1) entryPageCounts[entryPage].bounces++;
    }
    const seenPages = new Set<string>();
    pages.forEach(pv => {
      if (!seenPages.has(pv.page_path)) {
        seenPages.add(pv.page_path);
        pageCounts[pv.page_path].visitors++;
      }
    });
  });

  const topPages = Object.entries(pageCounts)
    .map(([path, data]) => ({ path, visitors: data.visitors, avgTime: 0, bounceRate: 0 }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const entryPages = Object.entries(entryPageCounts)
    .map(([path, data]) => ({
      path,
      visitors: data.visitors,
      bounceRate: data.visitors > 0 ? (data.bounces / data.visitors) * 100 : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10);

  const totalExits = Object.values(exitPageCounts).reduce((sum, c) => sum + c, 0);
  const exitPages = Object.entries(exitPageCounts)
    .map(([path, exits]) => ({
      path,
      exits,
      exitRate: totalExits > 0 ? (exits / totalExits) * 100 : 0,
    }))
    .sort((a, b) => b.exits - a.exits)
    .slice(0, 10);

  return { topPages, entryPages, exitPages };
}

/** Compute blog entry pages from session cross-domain tracking */
export function computeBlogEntryPages(uniqueSessions: AnalyticsSession[]) {
  const blogEntryPageCounts: Record<string, { visitors: Set<string>; sessions: number }> = {};
  uniqueSessions.forEach(s => {
    if (s.blog_landing_page) {
      const path = `sourcecodeals.com${s.blog_landing_page}`;
      if (!blogEntryPageCounts[path]) {
        blogEntryPageCounts[path] = { visitors: new Set(), sessions: 0 };
      }
      const visitorKey = getVisitorKey(s);
      if (visitorKey) blogEntryPageCounts[path].visitors.add(visitorKey);
      blogEntryPageCounts[path].sessions++;
    }
  });

  return Object.entries(blogEntryPageCounts)
    .map(([path, data]) => ({
      path,
      visitors: data.visitors.size,
      sessions: data.sessions,
    }))
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 20);
}

/** Compute top users with enhanced data, including anonymous visitors */
export function computeTopUsers(
  uniqueSessions: AnalyticsSession[],
  filteredConnectionsWithMilestones: AnalyticsConnection[],
  filteredPageViews: AnalyticsPageView[],
  sessionMap: Map<string, AnalyticsSession>,
  allProfilesMap: Map<string, AnalyticsProfile>,
  filters: AnalyticsFilter[],
  last7Days: string[]
) {
  const userConnectionCounts = new Map<string, number>();
  filteredConnectionsWithMilestones.forEach(c => {
    if (c.user_id) {
      userConnectionCounts.set(c.user_id, (userConnectionCounts.get(c.user_id) || 0) + 1);
    }
  });

  // Map visitor_id to user_id when both exist
  const visitorToUserId = new Map<string, string>();
  uniqueSessions.forEach(s => {
    if (s.user_id && s.visitor_id) {
      visitorToUserId.set(s.visitor_id, s.user_id);
    }
  });

  const visitorSessionCounts = new Map<string, number>();
  const visitorSessionData = new Map<string, {
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    source?: string;
    referrerDomain?: string;
    lastSeen?: string;
    totalTimeOnSite: number;
    hasUserId: boolean;
  }>();

  uniqueSessions.forEach(s => {
    const visitorKey = s.user_id || s.visitor_id;
    if (!visitorKey) return;

    visitorSessionCounts.set(visitorKey, (visitorSessionCounts.get(visitorKey) || 0) + 1);

    const existing = visitorSessionData.get(visitorKey);
    const isNewer = !existing || new Date(s.started_at ?? 0) > new Date(existing.lastSeen || '1970-01-01');

    if (isNewer) {
      visitorSessionData.set(visitorKey, {
        country: s.country ?? undefined,
        city: s.city ?? undefined,
        device: s.device_type ?? undefined,
        browser: s.browser ?? undefined,
        os: s.os ?? undefined,
        source: categorizeChannel(s.referrer, s.utm_source, s.utm_medium),
        referrerDomain: extractDomain(s.referrer ?? ''),
        lastSeen: s.started_at ?? undefined,
        totalTimeOnSite: (existing?.totalTimeOnSite || 0) + (s.session_duration_seconds || 0),
        hasUserId: existing?.hasUserId || !!s.user_id,
      });
    } else if (existing) {
      existing.totalTimeOnSite = (existing.totalTimeOnSite || 0) + (s.session_duration_seconds || 0);
      existing.hasUserId = existing.hasUserId || !!s.user_id;
    }
  });

  const allVisitorIds = new Set<string>();
  if (filters.length > 0) {
    uniqueSessions.forEach(s => {
      const key = s.user_id || s.visitor_id;
      if (key) allVisitorIds.add(key);
    });
  } else {
    visitorSessionCounts.forEach((_, id) => allVisitorIds.add(id));
  }

  // Compute activity days from page views (last 7 days)
  const visitorPageViewsByDate = new Map<string, Map<string, number>>();
  filteredPageViews.forEach(pv => {
    const session = sessionMap.get(pv.session_id || '');
    const visitorKey = session ? (session.user_id || session.visitor_id) : null;
    if (visitorKey) {
      if (!visitorPageViewsByDate.has(visitorKey)) {
        visitorPageViewsByDate.set(visitorKey, new Map());
      }
      try {
        const dateStr = format(parseISO(pv.created_at ?? new Date().toISOString()), 'yyyy-MM-dd');
        const visitorDates = visitorPageViewsByDate.get(visitorKey)!;
        visitorDates.set(dateStr, (visitorDates.get(dateStr) || 0) + 1);
      } catch { /* ignore */ }
    }
  });

  return Array.from(allVisitorIds)
    .map(id => {
      const sessionData = visitorSessionData.get(id);
      const resolvedUserId = visitorToUserId.get(id) || (allProfilesMap.has(id) ? id : null);
      const profile = resolvedUserId ? allProfilesMap.get(resolvedUserId) : null;
      const isAnonymous = !profile;
      const connectionCount = userConnectionCounts.get(resolvedUserId || id) || 0;
      const sessionCount = visitorSessionCounts.get(id) || 0;

      const name = !isAnonymous && profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown'
        : generateAnimalName(id);

      const visitorDates = visitorPageViewsByDate.get(id);
      const activityDays = last7Days.map(date => {
        const pageViewCount = visitorDates?.get(date) || 0;
        let level: 'none' | 'low' | 'medium' | 'high' = 'none';
        if (pageViewCount > 10) level = 'high';
        else if (pageViewCount > 3) level = 'medium';
        else if (pageViewCount > 0) level = 'low';
        return { date, pageViews: pageViewCount, level };
      });

      return {
        id,
        name,
        isAnonymous,
        company: profile?.company || '',
        sessions: sessionCount,
        pagesViewed: activityDays.reduce((sum, d) => sum + d.pageViews, 0),
        connections: connectionCount,
        country: sessionData?.country,
        city: sessionData?.city,
        device: sessionData?.device,
        browser: sessionData?.browser,
        os: sessionData?.os,
        source: sessionData?.source,
        referrerDomain: sessionData?.referrerDomain,
        lastSeen: sessionData?.lastSeen,
        timeOnSite: sessionData?.totalTimeOnSite || 0,
        activityDays,
      };
    })
    .filter(u => u.sessions > 0)
    .sort((a, b) => {
      const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
      const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.connections - a.connections;
    })
    .slice(0, 50);
}

/** Format daily metrics from either aggregated table or computed session data */
export function formatDailyMetrics(
  filters: AnalyticsFilter[],
  dailyMetrics: DailyMetricRow[],
  dailyVisitorSets: Map<string, Set<string>>,
  dailySessionCounts: Map<string, number>,
  dailyConnectionCounts: Map<string, number>,
  startDate: Date,
  endDate: Date
) {
  if (filters.length > 0) {
    const result: Array<{ date: string; visitors: number; sessions: number; connections: number; bounceRate: number }> = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      result.push({
        date: dateStr,
        visitors: dailyVisitorSets.get(dateStr)?.size || 0,
        sessions: dailySessionCounts.get(dateStr) || 0,
        connections: dailyConnectionCounts.get(dateStr) || 0,
        bounceRate: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return result;
  }

  if (dailyMetrics.length > 0) {
    return dailyMetrics.map(m => ({
      date: m.date,
      visitors: m.unique_visitors || 0,
      sessions: m.total_sessions || 0,
      connections: m.connection_requests || 0,
      bounceRate: m.bounce_rate || 0,
    }));
  }

  const result: Array<{ date: string; visitors: number; sessions: number; connections: number; bounceRate: number }> = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  while (currentDate <= end) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    result.push({
      date: dateStr,
      visitors: dailyVisitorSets.get(dateStr)?.size || 0,
      sessions: dailySessionCounts.get(dateStr) || 0,
      connections: dailyConnectionCounts.get(dateStr) || 0,
      bounceRate: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return result;
}
