import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, parseISO, differenceInDays } from "date-fns";
import type { AnalyticsFilter } from "@/contexts/AnalyticsFiltersContext";

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
  
  channels: Array<{ name: string; visitors: number; sessions: number; signups: number; connections: number; icon: string }>;
  referrers: Array<{ domain: string; visitors: number; sessions: number; signups: number; connections: number; favicon: string }>;
  campaigns: Array<{ name: string; visitors: number; sessions: number; signups: number; connections: number }>;
  keywords: Array<{ term: string; visitors: number; sessions: number; signups: number; connections: number }>;
  
  countries: Array<{ name: string; code: string; visitors: number; sessions: number; signups: number; connections: number }>;
  regions: Array<{ name: string; country: string; visitors: number; sessions: number; signups: number; connections: number }>;
  cities: Array<{ name: string; country: string; visitors: number; sessions: number; signups: number; connections: number }>;
  geoCoverage: number; // Percentage of sessions with geo data
  
  // NEW: Self-reported sources from profiles
  selfReportedSources: Array<{ source: string; signups: number; connections: number; keywords: string[] }>;
  
  topPages: Array<{ path: string; visitors: number; avgTime: number; bounceRate: number }>;
  entryPages: Array<{ path: string; visitors: number; bounceRate: number }>;
  exitPages: Array<{ path: string; exits: number; exitRate: number }>;
  blogEntryPages: Array<{ path: string; visitors: number; sessions: number }>;
  
  browsers: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  operatingSystems: Array<{ name: string; visitors: number; signups: number; percentage: number }>;
  devices: Array<{ type: string; visitors: number; signups: number; percentage: number }>;
  
  funnel: {
    stages: Array<{ name: string; count: number; dropoff: number }>;
    overallConversion: number;
  };
  
  topUsers: Array<{
    id: string;
    name: string;
    isAnonymous: boolean;
    company: string;
    sessions: number;
    pagesViewed: number;
    connections: number;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    source?: string;
    referrerDomain?: string;
    lastSeen?: string;
    timeOnSite?: number;
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

// Map self-reported sources (from signup "how did you hear about us") to channels
function selfReportedSourceToChannel(source: string | null): string | null {
  if (!source) return null;
  const s = source.toLowerCase().trim();
  
  // Map self-reported sources to standard channels
  if (s === 'google') return 'Organic Search';
  if (s === 'linkedin' || s === 'instagram' || s === 'twitter' || s === 'facebook' || s === 'reddit' || s === 'youtube') return 'Organic Social';
  if (s === 'ai') return 'AI';
  if (s === 'newsletter' || s === 'podcast') return 'Newsletter';
  if (s === 'friend') return 'Referral';  // Word of mouth is a referral
  if (s === 'billboard') return 'Other';
  if (s === 'other') return null;  // Fall back to session data for "other"
  
  return null;  // Unknown - fall back to session data
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
    let hostname: string;
    
    // Check if it's already a domain (no protocol) - common for utm_source values like "chatgpt.com"
    if (!url.includes('://') && !url.startsWith('/')) {
      hostname = url.replace('www.', '').toLowerCase();
    } else {
      hostname = new URL(url).hostname.replace('www.', '');
    }
    
    // Normalize known email service tracking domains to a single canonical domain
    // Brevo uses various subdomains like exdov.r.sp1-brevo.net, sendibt.com, etc.
    if (hostname.includes('brevo') || hostname.includes('sendibt') || hostname.includes('exdov')) {
      return 'brevo.com';
    }
    if (hostname.includes('mailchimp') || hostname.includes('mailchi.mp')) {
      return 'mailchimp.com';
    }
    if (hostname.includes('sendgrid')) {
      return 'sendgrid.com';
    }
    
    return hostname;
  } catch {
    // For values like "chatgpt.com" that aren't full URLs
    return url.replace('www.', '').toLowerCase();
  }
}

// Discovery source priority system - get the TRUE origin of a visitor
// Priority 1: original_external_referrer (cross-domain tracking from blog)
// Priority 2: utm_source (explicit attribution like chatgpt.com, brevo)
// Priority 3: referrer (immediate HTTP referrer - fallback)
function getDiscoverySource(session: {
  original_external_referrer?: string | null;
  utm_source?: string | null;
  referrer?: string | null;
}): string | null {
  if (session.original_external_referrer) return session.original_external_referrer;
  if (session.utm_source) return session.utm_source;
  return session.referrer || null;
}

// Find the first session with meaningful attribution data
// Priority: original_external_referrer > utm_source > referrer > any session
// This handles race conditions where the chronologically first session may have no referrer
function getFirstMeaningfulSession(sessions: any[]): any | null {
  if (!sessions || sessions.length === 0) return null;
  
  // Sessions come sorted DESC (most recent first), reverse for chronological
  const chronological = [...sessions].reverse();
  
  // Priority 1: First session with cross-domain tracking
  const withCrossDomain = chronological.find(s => s.original_external_referrer);
  if (withCrossDomain) return withCrossDomain;
  
  // Priority 2: First session with UTM source
  const withUtm = chronological.find(s => s.utm_source);
  if (withUtm) return withUtm;
  
  // Priority 3: First session with any referrer
  const withReferrer = chronological.find(s => s.referrer);
  if (withReferrer) return withReferrer;
  
  // Fallback: actual first session (truly direct)
  return chronological[0];
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
        // Current period sessions - include visitor_id, region, blog_landing_page and original_external_referrer for proper attribution
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false)
          .eq('is_production', true)
          .gte('started_at', startDateStr)
          .order('started_at', { ascending: false }),
        
        // Previous period sessions for trend
        supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false)
          .eq('is_production', true)
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
          .eq('is_bot', false)
          .eq('is_production', true)
          .gte('last_active_at', twoMinutesAgo),
        
        // Profiles for signups in the time range ONLY (CRITICAL FIX: must filter by date!)
        supabase
          .from('profiles')
          .select('id, first_name, last_name, company, buyer_type, referral_source, referral_source_detail, created_at')
          .gte('created_at', startDateStr),  // Only signups in the time range!
        
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
      const profiles = profilesResult.data || []; // Only NEW signups in time range
      const allConnectionsWithMilestones = allConnectionsWithMilestonesResult.data || [];
      
      // === CRITICAL FIX: Fetch profiles for ALL users who have sessions (for name display) ===
      // This is separate from the signup count - we need profiles for any user_id in sessions
      const allUserIdsFromSessions = new Set<string>();
      rawSessions.forEach(s => {
        if (s.user_id) allUserIdsFromSessions.add(s.user_id);
      });
      
      let allProfilesForUsers: Array<{ id: string; first_name: string | null; last_name: string | null; company: string | null }> = [];
      if (allUserIdsFromSessions.size > 0) {
        const { data: allProfilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, company')
          .in('id', Array.from(allUserIdsFromSessions));
        allProfilesForUsers = allProfilesData || [];
      }
      
      // Build complete profile map for name resolution (ALL users with sessions)
      const allProfilesMap = new Map(allProfilesForUsers.map(p => [p.id, p]));
      
      // === SIGNUP ATTRIBUTION: Map signups to their first session data ===
      // CRITICAL: Only profiles created in the time range should be counted as signups
      const signupProfileMap = new Map<string, typeof profiles[0]>();
      profiles.forEach(p => signupProfileMap.set(p.id, p));
      
      // Get profile IDs for the filtered signups
      const profileIds = profiles.map(p => p.id);
      
      // Fetch first-ever sessions for these specific profiles (not just 30-day sessions)
      // This ensures we get the TRUE first session, not just first session in the window
      type FirstSessionData = {
        id: string;
        session_id: string;
        user_id: string | null;
        visitor_id: string | null;
        referrer: string | null;
        original_external_referrer: string | null;
        blog_landing_page: string | null;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_term: string | null;
        country: string | null;
        city: string | null;
        region: string | null;
        browser: string | null;
        os: string | null;
        device_type: string | null;
        started_at: string;
      };
      let firstSessions: FirstSessionData[] = [];
      if (profileIds.length > 0) {
        const { data: firstSessionsData } = await supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, started_at, user_agent')
          .eq('is_bot', false)
          .eq('is_production', true)
          .in('user_id', profileIds)
          .order('started_at', { ascending: true });
        firstSessions = firstSessionsData || [];
      }
      
      // Create profile to BEST attribution session mapping for signup attribution
      // Uses smart first-touch: finds first session with meaningful attribution data
      const profileSessionsMap = new Map<string, FirstSessionData[]>();
      firstSessions.forEach(s => {
        if (s.user_id) {
          if (!profileSessionsMap.has(s.user_id)) {
            profileSessionsMap.set(s.user_id, []);
          }
          profileSessionsMap.get(s.user_id)!.push(s);
        }
      });
      
      const profileToFirstSession = new Map<string, FirstSessionData>();
      profileSessionsMap.forEach((sessions, userId) => {
        // Use smart first-touch: find first session with meaningful attribution
        // Sessions are sorted ASC, so first meaningful = best attribution
        const meaningfulSession = getFirstMeaningfulSession(sessions.reverse()); // reverse for DESC like the helper expects
        if (meaningfulSession) {
          profileToFirstSession.set(userId, meaningfulSession);
        }
      });
      
      // Build self-reported sources from profiles
      const selfReportedSourceMap: Record<string, { signups: number; connections: number; keywords: string[] }> = {};
      profiles.forEach(p => {
        if (p.referral_source) {
          const source = p.referral_source.toLowerCase().trim();
          if (!selfReportedSourceMap[source]) {
            selfReportedSourceMap[source] = { signups: 0, connections: 0, keywords: [] };
          }
          selfReportedSourceMap[source].signups++;
          if (p.referral_source_detail) {
            selfReportedSourceMap[source].keywords.push(p.referral_source_detail);
          }
        }
      });
      
      // Add connections to self-reported sources
      allConnectionsWithMilestones.forEach(c => {
        if (c.user_id) {
          const profile = signupProfileMap.get(c.user_id);
          if (profile?.referral_source) {
            const source = profile.referral_source.toLowerCase().trim();
            if (selfReportedSourceMap[source]) {
              selfReportedSourceMap[source].connections++;
            }
          }
        }
      });
      
      const selfReportedSources = Object.entries(selfReportedSourceMap)
        .map(([source, data]) => ({ 
          source: source.charAt(0).toUpperCase() + source.slice(1), 
          ...data,
          keywords: [...new Set(data.keywords)].slice(0, 5) // Dedupe and limit
        }))
        .sort((a, b) => b.signups - a.signups);
      
      // CRITICAL FIX #1: Filter out dev/bot traffic (defense in depth - also filtered at query level)
      const sessions = rawSessions.filter(s => 
        !isDevTraffic(s.referrer) &&
        !s.user_agent?.includes('Chrome/119.') &&
        !s.user_agent?.includes('Chrome/118.') &&
        !s.user_agent?.includes('Chrome/117.') &&
        !s.user_agent?.includes('HeadlessChrome')
      );
      const prevSessions = rawPrevSessions.filter(s => 
        !isDevTraffic(s.referrer) &&
        !s.user_agent?.includes('Chrome/119.') &&
        !s.user_agent?.includes('Chrome/118.') &&
        !s.user_agent?.includes('Chrome/117.') &&
        !s.user_agent?.includes('HeadlessChrome')
      );
      
      // Deduplicate sessions by session_id (keep first occurrence)
      const sessionMap = new Map<string, typeof sessions[0]>();
      sessions.forEach(s => {
        if (!sessionMap.has(s.session_id)) {
          sessionMap.set(s.session_id, s);
        }
      });
      let uniqueSessions = Array.from(sessionMap.values());
      
      // APPLY GLOBAL FILTERS to sessions
      if (filters.length > 0) {
        filters.forEach(filter => {
          if (filter.type === 'channel') {
            uniqueSessions = uniqueSessions.filter(s => {
              // Use discovery source priority for consistent filtering
              const discoverySource = getDiscoverySource(s);
              return categorizeChannel(discoverySource, s.utm_source, s.utm_medium) === filter.value;
            });
          }
          if (filter.type === 'referrer') {
            uniqueSessions = uniqueSessions.filter(s => {
              // Use discovery source priority - same logic used in Referrer card display
              const discoverySource = getDiscoverySource(s);
              const domain = extractDomain(discoverySource);
              // Match if domain equals filter, or if one contains the other (handles chatgpt vs chatgpt.com)
              return domain === filter.value || 
                     domain.includes(filter.value) || 
                     filter.value.includes(domain);
            });
          }
          if (filter.type === 'country') {
            uniqueSessions = uniqueSessions.filter(s => s.country === filter.value);
          }
          if (filter.type === 'city') {
            uniqueSessions = uniqueSessions.filter(s => s.city === filter.value);
          }
          if (filter.type === 'region') {
            uniqueSessions = uniqueSessions.filter(s => (s as any).region === filter.value);
          }
          if (filter.type === 'browser') {
            uniqueSessions = uniqueSessions.filter(s => s.browser === filter.value);
          }
          if (filter.type === 'os') {
            uniqueSessions = uniqueSessions.filter(s => s.os === filter.value);
          }
          if (filter.type === 'device') {
            uniqueSessions = uniqueSessions.filter(s => s.device_type === filter.value);
          }
          if (filter.type === 'campaign') {
            uniqueSessions = uniqueSessions.filter(s => s.utm_campaign === filter.value);
          }
          if (filter.type === 'keyword') {
            uniqueSessions = uniqueSessions.filter(s => s.utm_term === filter.value);
          }
        });
      }
      
      // For page filters, we need to filter by sessions that visited that page
      const pageFilter = filters.find(f => f.type === 'page');
      if (pageFilter) {
        // Find all session IDs that have page views matching the filter
        const matchingSessionIds = new Set(
          pageViews
            .filter(pv => pv.page_path === pageFilter.value)
            .map(pv => pv.session_id)
        );
        uniqueSessions = uniqueSessions.filter(s => matchingSessionIds.has(s.session_id));
      }
      
      // === FILTER PROPAGATION: Create filtered versions of all data ===
      // This ensures ALL cards respect the global filters
      
      // Get session IDs from filtered sessions
      const filteredSessionIds = new Set(uniqueSessions.map(s => s.session_id));
      
      // Get user IDs from filtered sessions
      const filteredUserIds = new Set<string>(
        uniqueSessions.filter(s => s.user_id).map(s => s.user_id as string)
      );
      
      // Filter page views to only include views from filtered sessions
      const filteredPageViews = filters.length > 0
        ? pageViews.filter(pv => pv.session_id && filteredSessionIds.has(pv.session_id))
        : pageViews;
      
      // Filter connections to only users with matching sessions
      const filteredConnections = filters.length > 0
        ? connections.filter(c => c.user_id && filteredUserIds.has(c.user_id))
        : connections;
      
      // Filter allConnectionsWithMilestones similarly
      const filteredConnectionsWithMilestones = filters.length > 0
        ? allConnectionsWithMilestones.filter(c => c.user_id && filteredUserIds.has(c.user_id))
        : allConnectionsWithMilestones;
      
      // Filter profiles (signups) to match active filters
      // When a channel/referrer filter is active, only count signups from that source
      let filteredProfiles = profiles;
      if (filters.length > 0) {
        filteredProfiles = profiles.filter(p => {
          const firstSession = profileToFirstSession.get(p.id);
          
          for (const filter of filters) {
            if (filter.type === 'channel') {
              // Check if profile's attributed channel matches the filter
              // Priority 1: Cross-domain tracking
              if (firstSession?.original_external_referrer) {
                const channel = categorizeChannel(firstSession.original_external_referrer, firstSession.utm_source, firstSession.utm_medium);
                if (channel === filter.value) return true;
              }
              // Priority 2: Self-reported source
              const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
              if (selfReportedChannel === filter.value) return true;
              // Priority 3: Session referrer
              if (firstSession) {
                const sessionChannel = categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium);
                if (sessionChannel === filter.value) return true;
              }
              return false;
            }
            if (filter.type === 'referrer') {
              // Check referrer domain match
              if (firstSession?.original_external_referrer) {
                if (extractDomain(firstSession.original_external_referrer) === filter.value) return true;
              }
              if (firstSession) {
                if (extractDomain(firstSession.referrer) === filter.value) return true;
              }
              // Check self-reported source as domain
              if (p.referral_source && p.referral_source.toLowerCase() + '.com' === filter.value) return true;
              return false;
            }
            if (filter.type === 'country') {
              if (firstSession?.country !== filter.value) return false;
            }
            if (filter.type === 'city') {
              if (firstSession?.city !== filter.value) return false;
            }
            if (filter.type === 'region') {
              if ((firstSession as any)?.region !== filter.value) return false;
            }
            if (filter.type === 'browser') {
              if (firstSession?.browser !== filter.value) return false;
            }
            if (filter.type === 'os') {
              if (firstSession?.os !== filter.value) return false;
            }
            if (filter.type === 'device') {
              if (firstSession?.device_type !== filter.value) return false;
            }
            if (filter.type === 'campaign') {
              if (firstSession?.utm_campaign !== filter.value) return false;
            }
            if (filter.type === 'keyword') {
              if (firstSession?.utm_term !== filter.value) return false;
            }
          }
          return true;
        });
      }
      
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
      
      const currentConnections = filteredConnections.length;
      const prevConnectionsCount = prevConnections.length;
      const connectionsTrend = prevConnectionsCount > 0 ? ((currentConnections - prevConnectionsCount) / prevConnectionsCount) * 100 : 0;
      
      // CRITICAL FIX #3: Conversion rate uses visitors, not sessions
      const conversionRate = currentVisitors > 0 ? (currentConnections / currentVisitors) * 100 : 0;
      const prevConversionRate = prevVisitors > 0 ? (prevConnectionsCount / prevVisitors) * 100 : 0;
      const conversionTrend = prevConversionRate > 0 ? ((conversionRate - prevConversionRate) / prevConversionRate) * 100 : 0;
      
      // Bounce rate (sessions with 1 page view) - uses filteredPageViews
      const sessionPageCounts = new Map<string, number>();
      filteredPageViews.forEach(pv => {
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
      
      filteredConnections.forEach(c => {
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
      const channelSignups: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        // Use discovery source priority: original_external_referrer > utm_source > referrer
        const discoverySource = getDiscoverySource(s);
        const channel = categorizeChannel(discoverySource, s.utm_source, s.utm_medium);
        if (!channelVisitors[channel]) {
          channelVisitors[channel] = new Set();
          channelSessions[channel] = 0;
        }
        const visitorKey = getVisitorKey(s);
        if (visitorKey) channelVisitors[channel].add(visitorKey);
        channelSessions[channel]++;
      });
      
      // === SMART ATTRIBUTION FOR CONNECTION USERS ===
      // Build a map of each connection user's BEST attribution session using first-touch logic
      // This ensures connections are attributed to the session with the best tracking data,
      // not a random session (which was the bug - userSessionMap just overwrote with last session)
      const connectionUserIds = new Set<string>();
      filteredConnections.forEach(c => {
        if (c.user_id) connectionUserIds.add(c.user_id);
      });
      
      // Fetch ALL sessions for these users (not just in time range) to find true first-touch
      type ConnectionSessionType = typeof sessions[0];
      let connectionUserSessions: ConnectionSessionType[] = [];
      if (connectionUserIds.size > 0) {
        const { data } = await supabase
          .from('user_sessions')
          .select('id, session_id, user_id, visitor_id, referrer, original_external_referrer, blog_landing_page, utm_source, utm_medium, utm_campaign, utm_term, country, city, region, browser, os, device_type, session_duration_seconds, started_at, user_agent')
          .eq('is_bot', false)
          .eq('is_production', true)
          .in('user_id', Array.from(connectionUserIds))
          .order('started_at', { ascending: false });
        connectionUserSessions = (data || []) as ConnectionSessionType[];
      }
      
      // Group sessions by user
      const userSessionGroups = new Map<string, ConnectionSessionType[]>();
      connectionUserSessions.forEach(s => {
        if (s.user_id) {
          if (!userSessionGroups.has(s.user_id)) {
            userSessionGroups.set(s.user_id, []);
          }
          userSessionGroups.get(s.user_id)!.push(s);
        }
      });
      
      // Build attribution map using smart first-touch logic
      const userToAttributionSession = new Map<string, ConnectionSessionType>();
      userSessionGroups.forEach((sessions, userId) => {
        const best = getFirstMeaningfulSession(sessions);
        if (best) userToAttributionSession.set(userId, best as ConnectionSessionType);
      });
      
      // Map connections to channels using smart attribution
      filteredConnections.forEach(c => {
        if (c.user_id) {
          const session = userToAttributionSession.get(c.user_id);
          if (session) {
            const discoverySource = getDiscoverySource(session);
            const channel = categorizeChannel(discoverySource, session.utm_source, session.utm_medium);
            channelConnections[channel] = (channelConnections[channel] || 0) + 1;
          }
        }
      });
      
      // Map signups to channels via first session - uses filteredProfiles
      // Priority: 1) Cross-domain tracking, 2) User-reported source, 3) Session referrer
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        
        // Priority 1: Cross-domain tracking (if we have it from blog script)
        if (firstSession?.original_external_referrer) {
          const channel = categorizeChannel(firstSession.original_external_referrer, firstSession.utm_source, firstSession.utm_medium);
          channelSignups[channel] = (channelSignups[channel] || 0) + 1;
          return;
        }
        
        // Priority 2: User-reported discovery source (real self-reported data!)
        const selfReportedChannel = selfReportedSourceToChannel(p.referral_source);
        if (selfReportedChannel) {
          channelSignups[selfReportedChannel] = (channelSignups[selfReportedChannel] || 0) + 1;
          return;
        }
        
        // Priority 3: Fall back to session referrer
        if (firstSession) {
          const channel = categorizeChannel(firstSession.referrer, firstSession.utm_source, firstSession.utm_medium);
          channelSignups[channel] = (channelSignups[channel] || 0) + 1;
        }
      });
      
      const channels = Object.keys(channelVisitors)
        .map(name => ({ 
          name, 
          visitors: channelVisitors[name].size, 
          sessions: channelSessions[name] || 0,
          signups: channelSignups[name] || 0,
          connections: channelConnections[name] || 0, 
          icon: getChannelIcon(name) 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Referrer breakdown - count unique visitors AND connections
      const referrerVisitors: Record<string, Set<string>> = {};
      const referrerSessions: Record<string, number> = {};
      const referrerConnections: Record<string, number> = {};
      const referrerSignups: Record<string, number> = {};
      
      uniqueSessions.forEach(s => {
        // Use discovery source priority: original_external_referrer > utm_source > referrer
        const discoverySource = getDiscoverySource(s);
        const domain = extractDomain(discoverySource);
        if (!referrerVisitors[domain]) {
          referrerVisitors[domain] = new Set();
          referrerSessions[domain] = 0;
        }
        const visitorKey = getVisitorKey(s);
        if (visitorKey) referrerVisitors[domain].add(visitorKey);
        referrerSessions[domain]++;
      });
      
      // Map connections to referrers via user's first-touch referrer using discovery source priority
      filteredConnections.forEach(c => {
        if (c.user_id) {
          const userSession = userToAttributionSession.get(c.user_id);
          if (userSession) {
            const discoverySource = getDiscoverySource(userSession);
            const domain = extractDomain(discoverySource);
            referrerConnections[domain] = (referrerConnections[domain] || 0) + 1;
          }
        }
      });
      
      // Map signups to referrers - uses filteredProfiles
      // Priority: 1) Cross-domain tracking, 2) User-reported source, 3) Session referrer
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        
        // Priority 1: Cross-domain tracking (if we have it)
        if (firstSession?.original_external_referrer) {
          const domain = extractDomain(firstSession.original_external_referrer);
          referrerSignups[domain] = (referrerSignups[domain] || 0) + 1;
          return;
        }
        
        // Priority 2: Use self-reported source as the referrer domain
        if (p.referral_source && p.referral_source !== 'other') {
          const sourceDomain = p.referral_source.toLowerCase() + '.com';
          referrerSignups[sourceDomain] = (referrerSignups[sourceDomain] || 0) + 1;
          return;
        }
        
        // Priority 3: Fall back to session referrer
        if (firstSession) {
          const domain = extractDomain(firstSession.referrer);
          referrerSignups[domain] = (referrerSignups[domain] || 0) + 1;
        }
      });
      
      const referrers = Object.keys(referrerVisitors)
        .map(domain => ({ 
          domain, 
          visitors: referrerVisitors[domain].size, 
          sessions: referrerSessions[domain] || 0,
          signups: referrerSignups[domain] || 0,
          connections: referrerConnections[domain] || 0, 
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32` 
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 20); // Show more referrers to include lower-volume sources like LinkedIn
      
      // Campaign breakdown - count unique visitors
      const campaignVisitors: Record<string, Set<string>> = {};
      const campaignSessions: Record<string, number> = {};
      const campaignSignups: Record<string, number> = {};
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
      // Map connections to campaigns using smart attribution
      const campaignConnections: Record<string, number> = {};
      filteredConnections.forEach(c => {
        if (c.user_id) {
          const userSession = userToAttributionSession.get(c.user_id);
          if (userSession?.utm_campaign) {
            campaignConnections[userSession.utm_campaign] = (campaignConnections[userSession.utm_campaign] || 0) + 1;
          }
        }
      });
      // Map signups to campaigns - uses filteredProfiles
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        if (firstSession?.utm_campaign) {
          campaignSignups[firstSession.utm_campaign] = (campaignSignups[firstSession.utm_campaign] || 0) + 1;
        }
      });
      
      const campaigns = Object.keys(campaignVisitors)
        .map(name => ({ 
          name, 
          visitors: campaignVisitors[name].size,
          sessions: campaignSessions[name] || 0,
          signups: campaignSignups[name] || 0,
          connections: campaignConnections[name] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Keyword breakdown - count unique visitors
      const keywordVisitors: Record<string, Set<string>> = {};
      const keywordSessions: Record<string, number> = {};
      const keywordSignups: Record<string, number> = {};
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
      // Map connections to keywords using smart attribution
      const keywordConnections: Record<string, number> = {};
      filteredConnections.forEach(c => {
        if (c.user_id) {
          const userSession = userToAttributionSession.get(c.user_id);
          if (userSession?.utm_term) {
            keywordConnections[userSession.utm_term] = (keywordConnections[userSession.utm_term] || 0) + 1;
          }
        }
      });
      // Map signups to keywords - uses filteredProfiles
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        if (firstSession?.utm_term) {
          keywordSignups[firstSession.utm_term] = (keywordSignups[firstSession.utm_term] || 0) + 1;
        }
      });
      
      const keywords = Object.keys(keywordVisitors)
        .map(term => ({ 
          term, 
          visitors: keywordVisitors[term].size,
          sessions: keywordSessions[term] || 0,
          signups: keywordSignups[term] || 0,
          connections: keywordConnections[term] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Geography breakdown - count unique visitors AND connections
      const countryVisitors: Record<string, Set<string>> = {};
      const countrySessions: Record<string, number> = {};
      const countryConnections: Record<string, number> = {};
      const countrySignups: Record<string, number> = {};
      const cityVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
      const cityConnections: Record<string, number> = {};
      const citySignups: Record<string, number> = {};
      const regionVisitors: Record<string, { visitors: Set<string>; sessions: number; country: string }> = {};
      const regionConnections: Record<string, number> = {};
      const regionSignups: Record<string, number> = {};
      
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
      
      // Map connections to geography via user's smart attribution session
      filteredConnections.forEach(c => {
        if (c.user_id) {
          const userSession = userToAttributionSession.get(c.user_id);
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
      
      // Map signups to geography - uses filteredProfiles
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        if (firstSession) {
          const country = firstSession.country || 'Unknown';
          countrySignups[country] = (countrySignups[country] || 0) + 1;
          
          if (firstSession.city) {
            const cityKey = `${firstSession.city}, ${country}`;
            citySignups[cityKey] = (citySignups[cityKey] || 0) + 1;
          }
          
          const region = (firstSession as any).region;
          if (region) {
            const regionKey = `${region}, ${country}`;
            regionSignups[regionKey] = (regionSignups[regionKey] || 0) + 1;
          }
        }
      });
      
      const countries = Object.keys(countryVisitors)
        .map(name => ({ 
          name, 
          code: name.substring(0, 2).toUpperCase(), 
          visitors: countryVisitors[name].size,
          sessions: countrySessions[name] || 0,
          signups: countrySignups[name] || 0,
          connections: countryConnections[name] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const regions = Object.entries(regionVisitors)
        .map(([key, data]) => ({ 
          name: key.split(',')[0].trim(), 
          country: data.country,
          visitors: data.visitors.size,
          sessions: data.sessions,
          signups: regionSignups[key] || 0,
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
          signups: citySignups[key] || 0,
          connections: cityConnections[key] || 0 
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 10);
      
      // Calculate geo coverage - percentage of sessions with country data
      const sessionsWithGeo = uniqueSessions.filter(s => s.country && s.country !== 'Unknown').length;
      const geoCoverage = uniqueSessions.length > 0 
        ? Math.round((sessionsWithGeo / uniqueSessions.length) * 100) 
        : 0;
      
      // Pages breakdown - uses filteredPageViews (already filtered by session IDs above)
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
      
      // NEW: Aggregate blog_landing_page from user_sessions (cross-domain entry pages)
      const blogEntryPageCounts: Record<string, { visitors: Set<string>; sessions: number }> = {};
      uniqueSessions.forEach(s => {
        if (s.blog_landing_page) {
          // Format with main site domain prefix for clarity
          const path = `sourcecodeals.com${s.blog_landing_page}`;
          if (!blogEntryPageCounts[path]) {
            blogEntryPageCounts[path] = { visitors: new Set(), sessions: 0 };
          }
          const visitorKey = getVisitorKey(s);
          if (visitorKey) blogEntryPageCounts[path].visitors.add(visitorKey);
          blogEntryPageCounts[path].sessions++;
        }
      });
      
      const blogEntryPages = Object.entries(blogEntryPageCounts)
        .map(([path, data]) => ({
          path,
          visitors: data.visitors.size,
          sessions: data.sessions,
        }))
        .sort((a, b) => b.visitors - a.visitors)
        .slice(0, 20);
      
      // Tech breakdown - count unique visitors, not sessions
      const browserVisitors: Record<string, Set<string>> = {};
      const browserSignups: Record<string, number> = {};
      const osVisitors: Record<string, Set<string>> = {};
      const osSignups: Record<string, number> = {};
      const deviceVisitors: Record<string, Set<string>> = {};
      const deviceSignups: Record<string, number> = {};
      
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
      
      // Map signups to tech stack - uses filteredProfiles
      filteredProfiles.forEach(p => {
        const firstSession = profileToFirstSession.get(p.id);
        if (firstSession) {
          const browser = firstSession.browser || 'Unknown';
          const os = firstSession.os || 'Unknown';
          const device = firstSession.device_type || 'Desktop';
          browserSignups[browser] = (browserSignups[browser] || 0) + 1;
          osSignups[os] = (osSignups[os] || 0) + 1;
          deviceSignups[device] = (deviceSignups[device] || 0) + 1;
        }
      });
      
      const totalVisitorsForPercent = currentVisitors || 1;
      
      // Filter out Unknown/null from top of lists
      const browsers = Object.entries(browserVisitors)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors: visitors.size, signups: browserSignups[name] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const operatingSystems = Object.entries(osVisitors)
        .filter(([name]) => name && name !== 'Unknown' && name !== 'null' && name !== 'undefined')
        .map(([name, visitors]) => ({ name, visitors: visitors.size, signups: osSignups[name] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      const devices = Object.entries(deviceVisitors)
        .filter(([type]) => type && type !== 'Unknown' && type !== 'null' && type !== 'undefined')
        .map(([type, visitors]) => ({ type, visitors: visitors.size, signups: deviceSignups[type] || 0, percentage: (visitors.size / totalVisitorsForPercent) * 100 }))
        .sort((a, b) => b.visitors - a.visitors);
      
      // Enhanced 6-stage funnel for M&A marketplace - uses FILTERED data
      const registeredUsers = new Set(uniqueSessions.filter(s => s.user_id).map(s => s.user_id));
      const connectingUsers = new Set(filteredConnections.map(c => c.user_id));
      
      // Count marketplace page views - uses filteredPageViews
      const marketplaceViews = new Set(
        filteredPageViews.filter(pv => pv.page_path?.includes('/marketplace') || pv.page_path === '/').map(pv => pv.session_id)
      ).size;
      
      // REAL NDA and Fee Agreement counts - uses filteredConnectionsWithMilestones
      const ndaSignedCount = filteredConnectionsWithMilestones.filter(c => c.lead_nda_signed === true).length;
      const feeAgreementCount = filteredConnectionsWithMilestones.filter(c => c.lead_fee_agreement_signed === true).length;
      
      // Get unique users who signed NDA/Fee Agreement
      const ndaSignedUsers = new Set(filteredConnectionsWithMilestones.filter(c => c.lead_nda_signed === true).map(c => c.user_id));
      const feeAgreementUsers = new Set(filteredConnectionsWithMilestones.filter(c => c.lead_fee_agreement_signed === true).map(c => c.user_id));
      
      const funnelStages = [
        { name: 'Visitors', count: currentVisitors, dropoff: 0 },
        { name: 'Marketplace', count: marketplaceViews, dropoff: currentVisitors > 0 ? ((currentVisitors - marketplaceViews) / currentVisitors) * 100 : 0 },
        { name: 'Registered', count: registeredUsers.size, dropoff: marketplaceViews > 0 ? ((marketplaceViews - registeredUsers.size) / marketplaceViews) * 100 : 0 },
        { name: 'NDA Signed', count: ndaSignedUsers.size, dropoff: registeredUsers.size > 0 ? ((registeredUsers.size - ndaSignedUsers.size) / registeredUsers.size) * 100 : 0 },
        { name: 'Fee Agreement', count: feeAgreementUsers.size, dropoff: ndaSignedUsers.size > 0 ? ((ndaSignedUsers.size - feeAgreementUsers.size) / ndaSignedUsers.size) * 100 : 0 },
        { name: 'Connected', count: connectingUsers.size, dropoff: feeAgreementUsers.size > 0 ? ((feeAgreementUsers.size - connectingUsers.size) / feeAgreementUsers.size) * 100 : 0 },
      ];
      
// === ANIMAL NAME GENERATION for anonymous visitors ===
      const ANIMALS = ['Wolf', 'Eagle', 'Lion', 'Tiger', 'Bear', 'Fox', 'Hawk', 'Panther', 'Falcon', 'Jaguar',
        'Raven', 'Phoenix', 'Dragon', 'Serpent', 'Griffin', 'Owl', 'Shark', 'Dolphin', 'Whale', 'Orca'];
      const COLORS = ['Azure', 'Crimson', 'Emerald', 'Golden', 'Ivory', 'Jade', 'Coral', 'Silver', 'Amber', 'Violet',
        'Scarlet', 'Cobalt', 'Bronze', 'Indigo', 'Platinum', 'Onyx', 'Ruby', 'Sapphire', 'Topaz', 'Pearl'];
      
      function generateAnimalName(id: string): string {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash = hash & hash;
        }
        const colorIndex = Math.abs(hash) % COLORS.length;
        const animalIndex = Math.abs(hash >> 8) % ANIMALS.length;
        return `${COLORS[colorIndex]} ${ANIMALS[animalIndex]}`;
      }
      
      // Top users with enhanced data - NOW INCLUDES ANONYMOUS VISITORS
      const userConnectionCounts = new Map<string, number>();
      filteredConnectionsWithMilestones.forEach(c => {
        if (c.user_id) {
          userConnectionCounts.set(c.user_id, (userConnectionCounts.get(c.user_id) || 0) + 1);
        }
      });
      
      // CRITICAL FIX: Map visitor_id to user_id when both exist (for linking anonymous sessions to registered users)
      const visitorToUserId = new Map<string, string>();
      uniqueSessions.forEach(s => {
        if (s.user_id && s.visitor_id) {
          visitorToUserId.set(s.visitor_id, s.user_id);
        }
      });
      
      // Track sessions by unified key (prefer user_id, fall back to visitor_id)
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
        hasUserId: boolean; // True if ANY session has user_id
      }>();
      
      uniqueSessions.forEach(s => {
        // Prefer user_id as the key for consistency
        const visitorKey = s.user_id || s.visitor_id;
        if (!visitorKey) return;
        
        visitorSessionCounts.set(visitorKey, (visitorSessionCounts.get(visitorKey) || 0) + 1);
        
        const existing = visitorSessionData.get(visitorKey);
        const isNewer = !existing || new Date(s.started_at) > new Date(existing.lastSeen || '1970-01-01');
        
        if (isNewer) {
          visitorSessionData.set(visitorKey, {
            country: s.country,
            city: s.city,
            device: s.device_type,
            browser: s.browser,
            os: s.os,
            source: categorizeChannel(s.referrer, s.utm_source, s.utm_medium),
            referrerDomain: extractDomain(s.referrer),
            lastSeen: s.started_at,
            totalTimeOnSite: (existing?.totalTimeOnSite || 0) + (s.session_duration_seconds || 0),
            hasUserId: existing?.hasUserId || !!s.user_id,
          });
        } else if (existing) {
          existing.totalTimeOnSite = (existing.totalTimeOnSite || 0) + (s.session_duration_seconds || 0);
          existing.hasUserId = existing.hasUserId || !!s.user_id;
        }
      });
      
      // Build allVisitorIds from all sessions with any identifier (includes anonymous)
      const allVisitorIds = new Set<string>();
      if (filters.length > 0) {
        uniqueSessions.forEach(s => {
          const key = s.user_id || s.visitor_id;
          if (key) allVisitorIds.add(key);
        });
      } else {
        visitorSessionCounts.forEach((_, id) => allVisitorIds.add(id));
      }
      
      // Note: Use allProfilesMap (all users with sessions) for name resolution, not profileMap (only new signups)
      
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
            const dateStr = format(parseISO(pv.created_at), 'yyyy-MM-dd');
            const visitorDates = visitorPageViewsByDate.get(visitorKey)!;
            visitorDates.set(dateStr, (visitorDates.get(dateStr) || 0) + 1);
          } catch { /* ignore */ }
        }
      });
      
      const topUsers = Array.from(allVisitorIds)
        .map(id => {
          const sessionData = visitorSessionData.get(id);
          
          // CRITICAL: Resolve user_id for profile lookup
          // If id is a visitor_id, check if it maps to a user_id
          const resolvedUserId = visitorToUserId.get(id) || (allProfilesMap.has(id) ? id : null);
          const profile = resolvedUserId ? allProfilesMap.get(resolvedUserId) : null;
          
          // Only anonymous if no profile exists (meaning no user_id anywhere)
          const isAnonymous = !profile;
          const connectionCount = userConnectionCounts.get(resolvedUserId || id) || 0;
          const sessionCount = visitorSessionCounts.get(id) || 0;
          
          // Use real name for registered users, animal name for truly anonymous
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
        // Sort by lastSeen (most recent first), then by connections
        .sort((a, b) => {
          const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          if (bTime !== aTime) return bTime - aTime;
          return b.connections - a.connections;
        })
        .slice(0, 50);
      
      // Format daily metrics
      // CRITICAL FIX: When filters are active, ALWAYS compute from filtered session data
      // The pre-aggregated daily_metrics table is NOT filtered, so it would show wrong data
      let formattedDailyMetrics: Array<{ date: string; visitors: number; sessions: number; connections: number; bounceRate: number }>;
      
      if (filters.length > 0) {
        // FILTERS ACTIVE: Compute from filtered uniqueSessions (which respects all filters)
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
      } else if (dailyMetrics.length > 0) {
        // NO FILTERS: Use pre-aggregated data from daily_metrics table for performance
        formattedDailyMetrics = dailyMetrics.map(m => ({
          date: m.date,
          visitors: (m as any).unique_visitors || 0,
          sessions: m.total_sessions || 0,
          connections: m.connection_requests || 0,
          bounceRate: m.bounce_rate || 0,
        }));
      } else {
        // FALLBACK: Compute from session data when no aggregated data exists
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
