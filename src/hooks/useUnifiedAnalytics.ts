import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, parseISO, differenceInDays } from "date-fns";

export interface KPIMetric {
  value: number;
  trend: number;
  sparkline: number[];
}

export interface UnifiedAnalyticsData {
  kpis: {
    visitors: KPIMetric;
    connections: KPIMetric;
    conversionRate: { value: number; trend: number };
    bounceRate: { value: number; trend: number };
    avgSessionTime: { value: number; trend: number };
    onlineNow: number;
  };
  
  dailyMetrics: Array<{
    date: string;
    visitors: number;
    connections: number;
    bounceRate: number;
  }>;
  
  channels: Array<{ name: string; visitors: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; connections: number }>;
  
  countries: Array<{ name: string; code: string; visitors: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; connections: number }>;
  
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  
  browsers: Array<{ name: string; visitors: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; percentage: number }>;
  
  funnel: {
    stages: Array<{ name: string; count: number; dropoff: number }>;
    overallConversion: number;
  };
  
  topUsers: Array<{
    id: string;
    name: string;
    company: string;
    sessions: number;
    pagesViewed: number;
    connections: number;
    country?: string;
    device?: string;
    browser?: string;
    os?: string;
    source?: string;
    lastSeen?: string;
    activityDays?: Array<{ date: string; pageViews: number; level: 'none' | 'low' | 'medium' | 'high' }>;
  }>;
}

function categorizeChannel(referrer: string | null, utmSource: string | null, utmMedium: string | null): string {
  if (!referrer && !utmSource) return 'Direct';
  
  const source = (referrer || utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();
  
  // AI Sources
  if (source.includes('chatgpt') || source.includes('openai')) return 'AI';
  if (source.includes('claude') || source.includes('anthropic')) return 'AI';
  if (source.includes('perplexity')) return 'AI';
  if (source.includes('gemini') || source.includes('bard')) return 'AI';
  
  // Organic Social
  if (source.includes('linkedin')) return 'Organic Social';
  if (source.includes('twitter') || source.includes('x.com')) return 'Organic Social';
  if (source.includes('facebook') || source.includes('fb.com')) return 'Organic Social';
  if (source.includes('instagram')) return 'Organic Social';
  
  // Organic Search
  if (source.includes('google') && !medium.includes('cpc')) return 'Organic Search';
  if (source.includes('bing')) return 'Organic Search';
  if (source.includes('duckduckgo')) return 'Organic Search';
  if (source.includes('brave')) return 'Organic Search';
  
  // Paid
  if (medium.includes('cpc') || medium.includes('paid')) return 'Paid';
  
  // Newsletter
  if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';
  
  // Referral
  if (referrer && !source.includes('direct')) return 'Referral';
  
  return 'Direct';
}

function extractDomain(url: string | null): string {
  if (!url) return 'Direct';
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getChannelIcon(channel: string): string {
  const icons: Record<string, string> = {
    'AI': 'sparkles',
    'Organic Social': 'users',
    'Organic Search': 'search',
    'Direct': 'globe',
    'Referral': 'link',
    'Paid': 'credit-card',
    'Newsletter': 'mail',
  };
  return icons[channel] || 'globe';
}

export function useUnifiedAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['unified-analytics', timeRangeDays],
    queryFn: async (): Promise<UnifiedAnalyticsData> => {
      const endDate = new Date();
      const startDate = subDays(endDate, timeRangeDays);
      const prevStartDate = subDays(startDate, timeRangeDays);
      const startDateStr = startDate.toISOString();
      const prevStartDateStr = prevStartDate.toISOString();
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      // Fetch all data in parallel
      const [
        sessionsResult,
        prevSessionsResult,
        connectionsResult,
        prevConnectionsResult,
        pageViewsResult,
        dailyMetricsResult,
        activeSessionsResult,
        profilesResult,
        // New: Query all connections with NDA/Fee Agreement data
        allConnectionsWithMilestonesResult,
      ] = await Promise.all([
        // Current period sessions
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, referrer, utm_source, utm_medium, utm_campaign, utm_term, country, city, browser, os, device_type, session_duration_seconds, started_at')
          .gte('started_at', startDateStr)
          .order('started_at', { ascending: false }),
        
        // Previous period sessions for trend
        supabase
          .from('user_sessions')
          .select('id, session_id, session_duration_seconds, started_at')
          .gte('started_at', prevStartDateStr)
          .lt('started_at', startDateStr),
        
        // Current period connections
        supabase
          .from('connection_requests')
          .select('id, user_id, listing_id, created_at')
          .gte('created_at', startDateStr),
        
        // Previous period connections for trend
        supabase
          .from('connection_requests')
          .select('id')
          .gte('created_at', prevStartDateStr)
          .lt('created_at', startDateStr),
        
        // Page views for bounce rate calculation
        supabase
          .from('page_views')
          .select('session_id, page_path, exit_page, created_at')
          .gte('created_at', startDateStr),
        
        // Daily metrics from aggregated table
        supabase
          .from('daily_metrics')
          .select('*')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .order('date', { ascending: true }),
        
        // Active sessions for online now
        supabase
          .from('user_sessions')
          .select('id')
          .eq('is_active', true)
          .gte('last_active_at', twoMinutesAgo),
        
        // Profiles for top users - get more to ensure we have all connected users
        supabase
          .from('profiles')
          .select('id, first_name, last_name, company, buyer_type')
          .limit(500),
        
        // NEW: Query all connections with NDA/Fee Agreement status for real funnel data
        supabase
          .from('connection_requests')
          .select('id, user_id, lead_nda_signed, lead_fee_agreement_signed, created_at')
          .gte('created_at', startDateStr),
      ]);
      
      const sessions = sessionsResult.data || [];
      const prevSessions = prevSessionsResult.data || [];
      const connections = connectionsResult.data || [];
      const prevConnections = prevConnectionsResult.data || [];
      const pageViews = pageViewsResult.data || [];
      const dailyMetrics = dailyMetricsResult.data || [];
      const activeSessions = activeSessionsResult.data || [];
      const profiles = profilesResult.data || [];
      const allConnectionsWithMilestones = allConnectionsWithMilestonesResult.data || [];
      
      // Deduplicate sessions by session_id
      const sessionMap = new Map<string, typeof sessions[0]>();
      sessions.forEach(s => {
        if (!sessionMap.has(s.session_id)) {
          sessionMap.set(s.session_id, s);
        }
      });
      const uniqueSessions = Array.from(sessionMap.values());
      
      // Calculate KPIs
      const currentVisitors = uniqueSessions.length;
      const prevVisitors = prevSessions.length;
      const visitorsTrend = prevVisitors > 0 ? ((currentVisitors - prevVisitors) / prevVisitors) * 100 : 0;
      
      const currentConnections = connections.length;
      const prevConnectionsCount = prevConnections.length;
      const connectionsTrend = prevConnectionsCount > 0 ? ((currentConnections - prevConnectionsCount) / prevConnectionsCount) * 100 : 0;
      
      const conversionRate = currentVisitors > 0 ? (currentConnections / currentVisitors) * 100 : 0;
      const prevConversionRate = prevVisitors > 0 ? (prevConnectionsCount / prevVisitors) * 100 : 0;
      const conversionTrend = prevConversionRate > 0 ? ((conversionRate - prevConversionRate) / prevConversionRate) * 100 : 0;
      
      // Bounce rate (sessions with 1 page view)
      const sessionPageCounts = new Map<string, number>();
      pageViews.forEach(pv => {
        if (pv.session_id) {
          sessionPageCounts.set(pv.session_id, (sessionPageCounts.get(pv.session_id) || 0) + 1);
        }
      });
      const bouncedSessions = Array.from(sessionPageCounts.values()).filter(c => c === 1).length;
      const bounceRate = sessionPageCounts.size > 0 ? (bouncedSessions / sessionPageCounts.size) * 100 : 0;
      
      // Average session time
      const sessionsWithDuration = uniqueSessions.filter(s => s.session_duration_seconds && s.session_duration_seconds > 0);
      const avgSessionTime = sessionsWithDuration.length > 0
        ? sessionsWithDuration.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0) / sessionsWithDuration.length
        : 0;
      
      // Sparklines (last 7 days) - COMPUTE FROM RAW DATA as fallback
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(endDate, 6 - i), 'yyyy-MM-dd'));
      
      // Build daily counts from raw sessions for sparklines
      const dailySessionCountsForSparkline = new Map<string, number>();
      const dailyConnectionCountsForSparkline = new Map<string, number>();
      
      uniqueSessions.forEach(s => {
        try {
          const dateStr = format(parseISO(s.started_at), 'yyyy-MM-dd');
          dailySessionCountsForSparkline.set(dateStr, (dailySessionCountsForSparkline.get(dateStr) || 0) + 1);
        } catch { /* ignore parse errors */ }
      });
      
      connections.forEach(c => {
        try {
          const dateStr = format(parseISO(c.created_at), 'yyyy-MM-dd');
          dailyConnectionCountsForSparkline.set(dateStr, (dailyConnectionCountsForSparkline.get(dateStr) || 0) + 1);
        } catch { /* ignore parse errors */ }
      });
      
      // Use raw data for sparklines (more reliable than empty daily_metrics)
      const visitorSparkline = last7Days.map(date => 
        dailySessionCountsForSparkline.get(date) || 0
      );
      const connectionSparkline = last7Days.map(date => 
        dailyConnectionCountsForSparkline.get(date) || 0
      );
      
      // Channel breakdown
      const channelCounts: Record<string, { visitors: number; connections: number }> = {};
      uniqueSessions.forEach(s => {
        const channel = categorizeChannel(s.referrer, s.utm_source, s.utm_medium);
        if (!channelCounts[channel]) channelCounts[channel] = { visitors: 0, connections: 0 };
        channelCounts[channel].visitors++;
      });
      
      // Map connections to channels (via user sessions)
      const userSessionMap = new Map<string, typeof sessions[0]>();
      uniqueSessions.forEach(s => {
        if (s.user_id) userSessionMap.set(s.user_id, s);
      });
      connections.forEach(c => {
        if (c.user_id) {
          const session = userSessionMap.get(c.user_id);
          if (session) {
            const channel = categorizeChannel(session.referrer, session.utm_source, session.utm_medium);
            if (channelCounts[channel]) channelCounts[channel].connections++;
          }
        }
      });
      
      const channels = Object.entries(channelCounts)
        .map(([name, data]) => ({ name, ...data, icon: getChannelIcon(name) }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Referrer breakdown
      const referrerCounts: Record<string, { visitors: number; connections: number }> = {};
      uniqueSessions.forEach(s => {
        const domain = extractDomain(s.referrer);
        if (!referrerCounts[domain]) referrerCounts[domain] = { visitors: 0, connections: 0 };
        referrerCounts[domain].visitors++;
      });
      const referrers = Object.entries(referrerCounts)
        .map(([domain, data]) => ({ domain, ...data, favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32` }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      // Campaign breakdown
      const campaignCounts: Record<string, { visitors: number; connections: number }> = {};
      uniqueSessions.forEach(s => {
        if (s.utm_campaign) {
          if (!campaignCounts[s.utm_campaign]) campaignCounts[s.utm_campaign] = { visitors: 0, connections: 0 };
          campaignCounts[s.utm_campaign].visitors++;
        }
      });
      const campaigns = Object.entries(campaignCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Keyword breakdown
      const keywordCounts: Record<string, { visitors: number; connections: number }> = {};
      uniqueSessions.forEach(s => {
        if (s.utm_term) {
          if (!keywordCounts[s.utm_term]) keywordCounts[s.utm_term] = { visitors: 0, connections: 0 };
          keywordCounts[s.utm_term].visitors++;
        }
      });
      const keywords = Object.entries(keywordCounts)
        .map(([term, data]) => ({ term, ...data }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Geography breakdown
      const countryCounts: Record<string, { visitors: number; connections: number }> = {};
      const cityCounts: Record<string, { visitors: number; connections: number; country: string }> = {};
      uniqueSessions.forEach(s => {
        const country = s.country || 'Unknown';
        if (!countryCounts[country]) countryCounts[country] = { visitors: 0, connections: 0 };
        countryCounts[country].visitors++;
        
        if (s.city) {
          const cityKey = `${s.city}, ${country}`;
          if (!cityCounts[cityKey]) cityCounts[cityKey] = { visitors: 0, connections: 0, country };
          cityCounts[cityKey].visitors++;
        }
      });
      
      const countries = Object.entries(countryCounts)
        .map(([name, data]) => ({ name, code: name.substring(0, 2).toUpperCase(), ...data }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const cities = Object.entries(cityCounts)
        .map(([name, data]) => ({ name: name.split(',')[0], ...data }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      // Pages breakdown
      const pageCounts: Record<string, { visitors: number; views: number }> = {};
      const entryPageCounts: Record<string, { visitors: number; bounces: number }> = {};
      const exitPageCounts: Record<string, number> = {};
      
      // Group page views by session
      const sessionPages: Record<string, typeof pageViews> = {};
      pageViews.forEach(pv => {
        if (pv.session_id) {
          if (!sessionPages[pv.session_id]) sessionPages[pv.session_id] = [];
          sessionPages[pv.session_id].push(pv);
        }
        
        // Count all page views
        if (!pageCounts[pv.page_path]) pageCounts[pv.page_path] = { visitors: 0, views: 0 };
        pageCounts[pv.page_path].views++;
        
        // Exit pages
        if (pv.exit_page) {
          exitPageCounts[pv.page_path] = (exitPageCounts[pv.page_path] || 0) + 1;
        }
      });
      
      // Calculate entry pages and unique visitors per page
      Object.entries(sessionPages).forEach(([sessionId, pages]) => {
        const sortedPages = pages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        if (sortedPages.length > 0) {
          const entryPage = sortedPages[0].page_path;
          if (!entryPageCounts[entryPage]) entryPageCounts[entryPage] = { visitors: 0, bounces: 0 };
          entryPageCounts[entryPage].visitors++;
          if (sortedPages.length === 1) entryPageCounts[entryPage].bounces++;
        }
        
        // Unique visitors per page
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
          bounceRate: data.visitors > 0 ? (data.bounces / data.visitors) * 100 : 0 
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      const totalExits = Object.values(exitPageCounts).reduce((sum, c) => sum + c, 0);
      const exitPages = Object.entries(exitPageCounts)
        .map(([path, exits]) => ({ 
          path, 
          exits, 
          exitRate: totalExits > 0 ? (exits / totalExits) * 100 : 0 
        }))
        .sort((a, b) => b.exits - a.exits)
        .slice(0, 10);
      
      // Tech breakdown - FILTER OUT NULL/UNKNOWN from top of lists
      const browserCounts: Record<string, number> = {};
      const osCounts: Record<string, number> = {};
      const deviceCounts: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        const browser = s.browser || 'Unknown';
        const os = s.os || 'Unknown';
        const device = s.device_type || 'Desktop';
        
        browserCounts[browser] = (browserCounts[browser] || 0) + 1;
        osCounts[os] = (osCounts[os] || 0) + 1;
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      });
      
      const totalForPercent = uniqueSessions.length || 1;
      
      // Filter out Unknown/null from top of lists but keep for percentage calculation
      const browsers = Object.entries(browserCounts)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors, percentage: (visitors / totalForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const operatingSystems = Object.entries(osCounts)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors, percentage: (visitors / totalForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const devices = Object.entries(deviceCounts)
        .filter(([type]) => type && type !== 'Unknown' && type !== 'null' && type !== 'undefined')
        .map(([type, visitors]) => ({ type, visitors, percentage: (visitors / totalForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Enhanced 6-stage funnel for M&A marketplace with REAL data
      const registeredUsers = new Set(uniqueSessions.filter(s => s.user_id).map(s => s.user_id));
      const connectingUsers = new Set(connections.map(c => c.user_id));
      
      // Count marketplace page views
      const marketplaceViews = new Set(
        pageViews.filter(pv => pv.page_path?.includes('/marketplace') || pv.page_path === '/').map(pv => pv.session_id)
      ).size;
      
      // REAL NDA and Fee Agreement counts from connection_requests
      const ndaSignedCount = allConnectionsWithMilestones.filter(c => c.lead_nda_signed === true).length;
      const feeAgreementCount = allConnectionsWithMilestones.filter(c => c.lead_fee_agreement_signed === true).length;
      const totalConnectionsCount = allConnectionsWithMilestones.length;
      
      // Get unique users who signed NDA/Fee Agreement
      const ndaSignedUsers = new Set(allConnectionsWithMilestones.filter(c => c.lead_nda_signed === true).map(c => c.user_id));
      const feeAgreementUsers = new Set(allConnectionsWithMilestones.filter(c => c.lead_fee_agreement_signed === true).map(c => c.user_id));
      
      const funnelStages = [
        { name: 'Visitors', count: currentVisitors, dropoff: 0 },
        { name: 'Marketplace', count: marketplaceViews, dropoff: currentVisitors > 0 ? ((currentVisitors - marketplaceViews) / currentVisitors) * 100 : 0 },
        { name: 'Registered', count: registeredUsers.size, dropoff: marketplaceViews > 0 ? ((marketplaceViews - registeredUsers.size) / marketplaceViews) * 100 : 0 },
        { name: 'NDA Signed', count: ndaSignedUsers.size, dropoff: registeredUsers.size > 0 ? ((registeredUsers.size - ndaSignedUsers.size) / registeredUsers.size) * 100 : 0 },
        { name: 'Fee Agreement', count: feeAgreementUsers.size, dropoff: ndaSignedUsers.size > 0 ? ((ndaSignedUsers.size - feeAgreementUsers.size) / ndaSignedUsers.size) * 100 : 0 },
        { name: 'Connected', count: connectingUsers.size, dropoff: feeAgreementUsers.size > 0 ? ((feeAgreementUsers.size - connectingUsers.size) / feeAgreementUsers.size) * 100 : 0 },
      ];
      
      // Top users with enhanced data - include ALL users who have connections
      // Build maps from ALL connections in period, not just those with sessions
      const userConnectionCounts = new Map<string, number>();
      allConnectionsWithMilestones.forEach(c => {
        if (c.user_id) {
          userConnectionCounts.set(c.user_id, (userConnectionCounts.get(c.user_id) || 0) + 1);
        }
      });
      
      const userSessionCounts = new Map<string, number>();
      const userSessionData = new Map<string, { country?: string; device?: string; browser?: string; os?: string; source?: string; lastSeen?: string }>();
      uniqueSessions.forEach(s => {
        if (s.user_id) {
          userSessionCounts.set(s.user_id, (userSessionCounts.get(s.user_id) || 0) + 1);
          // Keep the most recent session data
          const existing = userSessionData.get(s.user_id);
          if (!existing || new Date(s.started_at) > new Date(existing.lastSeen || 0)) {
            userSessionData.set(s.user_id, {
              country: s.country,
              device: s.device_type,
              browser: s.browser,
              os: s.os,
              source: categorizeChannel(s.referrer, s.utm_source, s.utm_medium),
              lastSeen: s.started_at,
            });
          }
        }
      });
      
      // Create a combined set of all user IDs with connections OR sessions
      const allUserIds = new Set<string>();
      userConnectionCounts.forEach((_, id) => allUserIds.add(id));
      userSessionCounts.forEach((_, id) => allUserIds.add(id));
      
      // Map profiles by ID for quick lookup
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      
      // Compute activity days from page views (last 7 days)
      const userPageViewsByDate = new Map<string, Map<string, number>>();
      pageViews.forEach(pv => {
        const session = sessionMap.get(pv.session_id || '');
        if (session?.user_id) {
          const userId = session.user_id;
          if (!userPageViewsByDate.has(userId)) {
            userPageViewsByDate.set(userId, new Map());
          }
          try {
            const dateStr = format(parseISO(pv.created_at), 'yyyy-MM-dd');
            const userDates = userPageViewsByDate.get(userId)!;
            userDates.set(dateStr, (userDates.get(dateStr) || 0) + 1);
          } catch { /* ignore */ }
        }
      });
      
      const topUsers = Array.from(allUserIds)
        .map(id => {
          const profile = profileMap.get(id);
          const sessionData = userSessionData.get(id);
          const connectionCount = userConnectionCounts.get(id) || 0;
          const sessionCount = userSessionCounts.get(id) || 0;
          
          // Build activity days for this user
          const userDates = userPageViewsByDate.get(id);
          const activityDays = last7Days.map(date => {
            const pageViewCount = userDates?.get(date) || 0;
            let level: 'none' | 'low' | 'medium' | 'high' = 'none';
            if (pageViewCount > 10) level = 'high';
            else if (pageViewCount > 3) level = 'medium';
            else if (pageViewCount > 0) level = 'low';
            return { date, pageViews: pageViewCount, level };
          });
          
          return {
            id,
            name: profile 
              ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Anonymous'
              : 'Anonymous Visitor',
            company: profile?.company || '',
            sessions: sessionCount,
            pagesViewed: activityDays.reduce((sum, d) => sum + d.pageViews, 0),
            connections: connectionCount,
            country: sessionData?.country,
            device: sessionData?.device,
            browser: sessionData?.browser,
            os: sessionData?.os,
            source: sessionData?.source,
            lastSeen: sessionData?.lastSeen,
            activityDays,
          };
        })
        .filter(u => u.connections > 0 || u.sessions > 0) // Must have some activity
        .sort((a, b) => b.connections - a.connections || b.sessions - a.sessions)
        .slice(0, 25);
      
      // Format daily metrics - FALLBACK to computing from raw data if empty
      let formattedDailyMetrics: Array<{ date: string; visitors: number; connections: number; bounceRate: number }>;
      
      if (dailyMetrics.length > 0) {
        // Use aggregated daily_metrics table
        formattedDailyMetrics = dailyMetrics.map(m => ({
          date: m.date,
          visitors: m.total_sessions || 0,
          connections: m.connection_requests || 0,
          bounceRate: m.bounce_rate || 0,
        }));
      } else {
        // FALLBACK: Compute from raw sessions and connections
        const dailySessionCounts = new Map<string, number>();
        const dailyConnectionCounts = new Map<string, number>();
        
        uniqueSessions.forEach(s => {
          const dateStr = format(parseISO(s.started_at), 'yyyy-MM-dd');
          dailySessionCounts.set(dateStr, (dailySessionCounts.get(dateStr) || 0) + 1);
        });
        
        connections.forEach(c => {
          const dateStr = format(parseISO(c.created_at), 'yyyy-MM-dd');
          dailyConnectionCounts.set(dateStr, (dailyConnectionCounts.get(dateStr) || 0) + 1);
        });
        
        // Generate array for all days in range
        formattedDailyMetrics = [];
        const currentDate = new Date(startDate);
        const end = new Date(endDate);
        while (currentDate <= end) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          formattedDailyMetrics.push({
            date: dateStr,
            visitors: dailySessionCounts.get(dateStr) || 0,
            connections: dailyConnectionCounts.get(dateStr) || 0,
            bounceRate: 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      return {
        kpis: {
          visitors: { value: currentVisitors, trend: visitorsTrend, sparkline: visitorSparkline },
          connections: { value: currentConnections, trend: connectionsTrend, sparkline: connectionSparkline },
          conversionRate: { value: conversionRate, trend: conversionTrend },
          bounceRate: { value: bounceRate, trend: 0 },
          avgSessionTime: { value: avgSessionTime, trend: 0 },
          onlineNow: activeSessions.length,
        },
        dailyMetrics: formattedDailyMetrics,
        channels,
        referrers,
        campaigns,
        keywords,
        countries,
        regions: [], // Would need additional data
        cities,
        topPages,
        entryPages,
        exitPages,
        browsers,
        operatingSystems,
        devices,
        funnel: {
          stages: funnelStages,
          overallConversion: conversionRate,
        },
        topUsers,
      };
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
