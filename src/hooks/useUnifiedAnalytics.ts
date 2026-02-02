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
    sessions: KPIMetric; // NEW: separate sessions metric
    connections: KPIMetric;
    conversionRate: { value: number; trend: number };
    bounceRate: { value: number; trend: number };
    avgSessionTime: { value: number; trend: number };
    onlineNow: number;
  };
  
  dailyMetrics: Array<{
    date: string;
    visitors: number;
    sessions: number;
    connections: number;
    bounceRate: number;
  }>;
  
  channels: Array<{ name: string; visitors: number; sessions: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; sessions: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; sessions: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; sessions: number; connections: number }>;
  
  countries: Array<{ name: string; code: string; visitors: number; sessions: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; sessions: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; sessions: number; connections: number }>;
  
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

// Dev/bot traffic patterns to filter out
const DEV_TRAFFIC_PATTERNS = [
  'lovable.dev',
  'lovableproject.com',
  'preview--',
  'localhost',
  '127.0.0.1',
];

function isDevTraffic(referrer: string | null): boolean {
  if (!referrer) return false;
  const lowerReferrer = referrer.toLowerCase();
  return DEV_TRAFFIC_PATTERNS.some(pattern => lowerReferrer.includes(pattern));
}

function categorizeChannel(referrer: string | null, utmSource: string | null, utmMedium: string | null): string {
  if (!referrer && !utmSource) return 'Direct';
  
  const source = (referrer || utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();
  
  // CRITICAL FIX: Detect email platform domains FIRST (Brevo, Mailchimp, etc.)
  // These don't always have UTM tags but ARE newsletter traffic
  if (source.includes('brevo') || source.includes('sendibt') || 
      source.includes('mailchimp') || source.includes('sendgrid') ||
      source.includes('hubspot') || source.includes('klaviyo') ||
      source.includes('campaign-archive') || source.includes('mailchi.mp')) return 'Newsletter';
  
  // Newsletter via UTM medium
  if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';
  
  // Internal navigation (exclude from meaningful sources)
  if (source.includes('marketplace.sourcecodeals.com')) return 'Internal';
  
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

// Helper to get unique visitor key from a session
// CRITICAL FIX: Only return a key if we have a real identifier (user_id or visitor_id)
// Sessions without these are anonymous/untrackable and should NOT count as unique visitors
function getVisitorKey(session: { user_id?: string | null; visitor_id?: string | null; session_id: string }): string | null {
  if (session.user_id) return session.user_id;
  if (session.visitor_id) return session.visitor_id;
  return null; // Anonymous session - don't count as unique visitor
}

// Helper to check if a session has trackable identity
function hasVisitorIdentity(session: { user_id?: string | null; visitor_id?: string | null }): boolean {
  return Boolean(session.user_id || session.visitor_id);
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
        allConnectionsWithMilestonesResult,
      ] = await Promise.all([
        // Current period sessions - include visitor_id and region for proper counting
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, session_duration_seconds, started_at')
          .gte('started_at', startDateStr)
          .order('started_at', { ascending: false }),
        
        // Previous period sessions for trend
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, session_duration_seconds, started_at')
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
        
        // Profiles for top users
        supabase
          .from('profiles')
          .select('id, first_name, last_name, company, buyer_type')
          .limit(500),
        
        // Query all connections with NDA/Fee Agreement status for real funnel data
        supabase
          .from('connection_requests')
          .select('id, user_id, lead_nda_signed, lead_fee_agreement_signed, created_at')
          .gte('created_at', startDateStr),
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
      
      // CRITICAL FIX #1: Filter out dev/bot traffic
      const sessions = rawSessions.filter(s => !isDevTraffic(s.referrer));
      const prevSessions = rawPrevSessions.filter(s => !isDevTraffic(s.referrer));
      
      // Deduplicate sessions by session_id (keep first occurrence)
      const sessionMap = new Map<string, typeof sessions[0]>();
      sessions.forEach(s => {
        if (!sessionMap.has(s.session_id)) {
          sessionMap.set(s.session_id, s);
        }
      });
      const uniqueSessions = Array.from(sessionMap.values());
      
      // CRITICAL FIX #2: Count unique VISITORS (people), not sessions
      // Only count sessions with identifiable visitors (user_id or visitor_id)
      const currentVisitorSet = new Set<string>();
      uniqueSessions.forEach(s => {
        const key = getVisitorKey(s);
        if (key) currentVisitorSet.add(key);
      });
      const currentVisitors = currentVisitorSet.size;
      const currentSessionCount = uniqueSessions.length;
      
      // Same for previous period
      const prevSessionMap = new Map<string, typeof prevSessions[0]>();
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
      
      // Calculate trends using correct visitor counts
      const visitorsTrend = prevVisitors > 0 ? ((currentVisitors - prevVisitors) / prevVisitors) * 100 : 0;
      const sessionsTrend = prevSessionCount > 0 ? ((currentSessionCount - prevSessionCount) / prevSessionCount) * 100 : 0;
      
      const currentConnections = connections.length;
      const prevConnectionsCount = prevConnections.length;
      const connectionsTrend = prevConnectionsCount > 0 ? ((currentConnections - prevConnectionsCount) / prevConnectionsCount) * 100 : 0;
      
      // CRITICAL FIX #3: Conversion rate uses visitors, not sessions
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
      
      // Sparklines (last 7 days) - Count unique VISITORS per day, not sessions
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(endDate, 6 - i), 'yyyy-MM-dd'));
      
      // Build daily visitor and session counts
      const dailyVisitorSets = new Map<string, Set<string>>();
      const dailySessionCounts = new Map<string, number>();
      const dailyConnectionCounts = new Map<string, number>();
      
      uniqueSessions.forEach(s => {
        try {
          const dateStr = format(parseISO(s.started_at), 'yyyy-MM-dd');
          
          // Count unique visitors per day (only identifiable ones)
          const visitorKey = getVisitorKey(s);
          if (visitorKey) {
            if (!dailyVisitorSets.has(dateStr)) {
              dailyVisitorSets.set(dateStr, new Set());
            }
            dailyVisitorSets.get(dateStr)!.add(visitorKey);
          }
          
          // Count sessions per day
          dailySessionCounts.set(dateStr, (dailySessionCounts.get(dateStr) || 0) + 1);
        } catch { /* ignore parse errors */ }
      });
      
      connections.forEach(c => {
        try {
          const dateStr = format(parseISO(c.created_at), 'yyyy-MM-dd');
          dailyConnectionCounts.set(dateStr, (dailyConnectionCounts.get(dateStr) || 0) + 1);
        } catch { /* ignore parse errors */ }
      });
      
      // Sparklines use unique visitors
      const visitorSparkline = last7Days.map(date => 
        dailyVisitorSets.get(date)?.size || 0
      );
      const sessionSparkline = last7Days.map(date => 
        dailySessionCounts.get(date) || 0
      );
      const connectionSparkline = last7Days.map(date => 
        dailyConnectionCounts.get(date) || 0
      );
      
      // CRITICAL FIX #4: Channel breakdown counts unique visitors, not sessions
      const channelVisitors: Record<string, Set<string>> = {};
      const channelSessions: Record<string, number> = {};
      const channelConnections: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        const channel = categorizeChannel(s.referrer, s.utm_source, s.utm_medium);
        if (!channelVisitors[channel]) {
          channelVisitors[channel] = new Set();
          channelSessions[channel] = 0;
        }
        const visitorKey = getVisitorKey(s);
        if (visitorKey) channelVisitors[channel].add(visitorKey);
        channelSessions[channel]++;
      });
      
      // Map connections to channels
      const userSessionMap = new Map<string, typeof sessions[0]>();
      uniqueSessions.forEach(s => {
        if (s.user_id) userSessionMap.set(s.user_id, s);
      });
      connections.forEach(c => {
        if (c.user_id) {
          const session = userSessionMap.get(c.user_id);
          if (session) {
            const channel = categorizeChannel(session.referrer, session.utm_source, session.utm_medium);
            channelConnections[channel] = (channelConnections[channel] || 0) + 1;
          }
        }
      });
      
      const channels = Object.keys(channelVisitors)
        .map(name => ({ 
          name, 
          visitors: channelVisitors[name].size, 
          sessions: channelSessions[name] || 0,
          connections: channelConnections[name] || 0, 
          icon: getChannelIcon(name) 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Referrer breakdown - count unique visitors AND connections
      const referrerVisitors: Record<string, Set<string>> = {};
      const referrerSessions: Record<string, number> = {};
      const referrerConnections: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        const domain = extractDomain(s.referrer);
        if (!referrerVisitors[domain]) {
          referrerVisitors[domain] = new Set();
          referrerSessions[domain] = 0;
        }
        const visitorKey = getVisitorKey(s);
        if (visitorKey) referrerVisitors[domain].add(visitorKey);
        referrerSessions[domain]++;
      });
      
      // Map connections to referrers via user's first-touch referrer
      connections.forEach(c => {
        if (c.user_id) {
          const userSession = userSessionMap.get(c.user_id);
          if (userSession) {
            const domain = extractDomain(userSession.referrer);
            referrerConnections[domain] = (referrerConnections[domain] || 0) + 1;
          }
        }
      });
      
      const referrers = Object.keys(referrerVisitors)
        .map(domain => ({ 
          domain, 
          visitors: referrerVisitors[domain].size, 
          sessions: referrerSessions[domain] || 0,
          connections: referrerConnections[domain] || 0, 
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32` 
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      // Campaign breakdown - count unique visitors
      const campaignVisitors: Record<string, Set<string>> = {};
      const campaignSessions: Record<string, number> = {};
      uniqueSessions.forEach(s => {
        if (s.utm_campaign) {
          if (!campaignVisitors[s.utm_campaign]) {
            campaignVisitors[s.utm_campaign] = new Set();
            campaignSessions[s.utm_campaign] = 0;
          }
          const visitorKey = getVisitorKey(s);
          if (visitorKey) campaignVisitors[s.utm_campaign].add(visitorKey);
          campaignSessions[s.utm_campaign]++;
        }
      });
      // Map connections to campaigns
      const campaignConnections: Record<string, number> = {};
      connections.forEach(c => {
        if (c.user_id) {
          const userSession = userSessionMap.get(c.user_id);
          if (userSession?.utm_campaign) {
            campaignConnections[userSession.utm_campaign] = (campaignConnections[userSession.utm_campaign] || 0) + 1;
          }
        }
      });
      
      const campaigns = Object.keys(campaignVisitors)
        .map(name => ({ 
          name, 
          visitors: campaignVisitors[name].size,
          sessions: campaignSessions[name] || 0,
          connections: campaignConnections[name] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Keyword breakdown - count unique visitors
      const keywordVisitors: Record<string, Set<string>> = {};
      const keywordSessions: Record<string, number> = {};
      uniqueSessions.forEach(s => {
        if (s.utm_term) {
          if (!keywordVisitors[s.utm_term]) {
            keywordVisitors[s.utm_term] = new Set();
            keywordSessions[s.utm_term] = 0;
          }
          const visitorKey = getVisitorKey(s);
          if (visitorKey) keywordVisitors[s.utm_term].add(visitorKey);
          keywordSessions[s.utm_term]++;
        }
      });
      // Map connections to keywords
      const keywordConnections: Record<string, number> = {};
      connections.forEach(c => {
        if (c.user_id) {
          const userSession = userSessionMap.get(c.user_id);
          if (userSession?.utm_term) {
            keywordConnections[userSession.utm_term] = (keywordConnections[userSession.utm_term] || 0) + 1;
          }
        }
      });
      
      const keywords = Object.keys(keywordVisitors)
        .map(term => ({ 
          term, 
          visitors: keywordVisitors[term].size,
          sessions: keywordSessions[term] || 0,
          connections: keywordConnections[term] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Geography breakdown - count unique visitors AND connections
      const countryVisitors: Record<string, Set<string>> = {};
      const countrySessions: Record<string, number> = {};
      const countryConnections: Record<string, number> = {};
      const cityVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
      const cityConnections: Record<string, number> = {};
      const regionVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
      const regionConnections: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        const country = s.country || 'Unknown';
        const visitorKey = getVisitorKey(s);
        
        if (!countryVisitors[country]) {
          countryVisitors[country] = new Set();
          countrySessions[country] = 0;
        }
        if (visitorKey) countryVisitors[country].add(visitorKey);
        countrySessions[country]++;
        
        // City aggregation
        if (s.city) {
          const cityKey = `${s.city}, ${country}`;
          if (!cityVisitors[cityKey]) {
            cityVisitors[cityKey] = { visitors: new Set(), sessions: 0, country };
          }
          if (visitorKey) cityVisitors[cityKey].visitors.add(visitorKey);
          cityVisitors[cityKey].sessions++;
        }
        
        // Region aggregation - use the actual region field
        const region = (s as any).region;
        if (region) {
          const regionKey = `${region}, ${country}`;
          if (!regionVisitors[regionKey]) {
            regionVisitors[regionKey] = { visitors: new Set(), sessions: 0, country };
          }
          if (visitorKey) regionVisitors[regionKey].visitors.add(visitorKey);
          regionVisitors[regionKey].sessions++;
        }
      });
      
      // Map connections to geography via user's session
      connections.forEach(c => {
        if (c.user_id) {
          const userSession = userSessionMap.get(c.user_id);
          if (userSession) {
            const country = userSession.country || 'Unknown';
            countryConnections[country] = (countryConnections[country] || 0) + 1;
            
            if (userSession.city) {
              const cityKey = `${userSession.city}, ${country}`;
              cityConnections[cityKey] = (cityConnections[cityKey] || 0) + 1;
            }
            
            const region = (userSession as any).region;
            if (region) {
              const regionKey = `${region}, ${country}`;
              regionConnections[regionKey] = (regionConnections[regionKey] || 0) + 1;
            }
          }
        }
      });
      
      const countries = Object.keys(countryVisitors)
        .map(name => ({ 
          name, 
          code: name.substring(0, 2).toUpperCase(), 
          visitors: countryVisitors[name].size,
          sessions: countrySessions[name] || 0,
          connections: countryConnections[name] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const regions = Object.entries(regionVisitors)
        .map(([key, data]) => ({ 
          name: key.split(',')[0].trim(), 
          country: data.country,
          visitors: data.visitors.size,
          sessions: data.sessions,
          connections: regionConnections[key] || 0 
        }))
        .filter(r => r.name && r.name !== 'Unknown')
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      const cities = Object.entries(cityVisitors)
        .map(([key, data]) => ({ 
          name: key.split(',')[0].trim(), 
          country: data.country,
          visitors: data.visitors.size,
          sessions: data.sessions,
          connections: cityConnections[key] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      // Pages breakdown - FILTER by production sessions only
      const productionSessionIds = new Set(uniqueSessions.map(s => s.session_id));
      const filteredPageViews = pageViews.filter(pv => productionSessionIds.has(pv.session_id));
      
      const pageCounts: Record<string, { visitors: number; views: number }> = {};
      const entryPageCounts: Record<string, { visitors: number; bounces: number }> = {};
      const exitPageCounts: Record<string, number> = {};
      
      // Group page views by session
      const sessionPages: Record<string, typeof filteredPageViews> = {};
      filteredPageViews.forEach(pv => {
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
      
      // Tech breakdown - count unique visitors, not sessions
      const browserVisitors: Record<string, Set<string>> = {};
      const osVisitors: Record<string, Set<string>> = {};
      const deviceVisitors: Record<string, Set<string>> = {};
      
      uniqueSessions.forEach(s => {
        const browser = s.browser || 'Unknown';
        const os = s.os || 'Unknown';
        const device = s.device_type || 'Desktop';
        const visitorKey = getVisitorKey(s);
        
        if (!browserVisitors[browser]) browserVisitors[browser] = new Set();
        if (!osVisitors[os]) osVisitors[os] = new Set();
        if (!deviceVisitors[device]) deviceVisitors[device] = new Set();
        
        if (visitorKey) {
          browserVisitors[browser].add(visitorKey);
          osVisitors[os].add(visitorKey);
          deviceVisitors[device].add(visitorKey);
        }
      });
      
      const totalVisitorsForPercent = currentVisitors || 1;
      
      // Filter out Unknown/null from top of lists
      const browsers = Object.entries(browserVisitors)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors: visitors.size, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const operatingSystems = Object.entries(osVisitors)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors: visitors.size, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const devices = Object.entries(deviceVisitors)
        .filter(([type]) => type && type !== 'Unknown' && type !== 'null' && type !== 'undefined')
        .map(([type, visitors]) => ({ type, visitors: visitors.size, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
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
      
      // Top users with enhanced data
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
      
      const allUserIds = new Set<string>();
      userConnectionCounts.forEach((_, id) => allUserIds.add(id));
      userSessionCounts.forEach((_, id) => allUserIds.add(id));
      
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
        .filter(u => u.connections > 0 || u.sessions > 0)
        .sort((a, b) => b.connections - a.connections || b.sessions - a.sessions)
        .slice(0, 25);
      
      // Format daily metrics - FALLBACK to computing from raw data if empty
      // Use unique_visitors column if available, otherwise compute
      let formattedDailyMetrics: Array<{ date: string; visitors: number; sessions: number; connections: number; bounceRate: number }>;
      
      if (dailyMetrics.length > 0) {
        formattedDailyMetrics = dailyMetrics.map(m => ({
          date: m.date,
          visitors: (m as any).unique_visitors || 0, // Use unique_visitors if backfilled
          sessions: m.total_sessions || 0,
          connections: m.connection_requests || 0,
          bounceRate: m.bounce_rate || 0,
        }));
      } else {
        // FALLBACK: Compute from raw sessions and connections
        formattedDailyMetrics = [];
        const currentDate = new Date(startDate);
        const end = new Date(endDate);
        while (currentDate <= end) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          formattedDailyMetrics.push({
            date: dateStr,
            visitors: dailyVisitorSets.get(dateStr)?.size || 0,
            sessions: dailySessionCounts.get(dateStr) || 0,
            connections: dailyConnectionCounts.get(dateStr) || 0,
            bounceRate: 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      return {
        kpis: {
          visitors: { value: currentVisitors, trend: visitorsTrend, sparkline: visitorSparkline },
          sessions: { value: currentSessionCount, trend: sessionsTrend, sparkline: sessionSparkline },
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
        regions,
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
