import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, differenceInSeconds, differenceInDays } from "date-fns";

export interface UserEvent {
  id: string;
  type: 'page_view' | 'event';
  timestamp: string;
  title: string;
  description?: string;
  path?: string;
  metadata?: Record<string, any>;
}

export interface UserActivityDay {
  date: string;
  pageViews: number;
  level: 'none' | 'low' | 'medium' | 'high';
}

export interface UserDetailData {
  profile: {
    id: string;
    name: string;
    email?: string;
    company?: string;
    buyerType?: string;
    avatarUrl?: string;
    isAnonymous: boolean;
  };
  geo: {
    country: string;
    city: string;
    region?: string;
  };
  tech: {
    device: string;
    os: string;
    browser: string;
  };
  stats: {
    totalPageviews: number;
    totalSessions: number;
    totalTimeOnSite: number; // seconds
    firstSeen: string;
    lastSeen: string;
    timeToConvert?: number; // seconds
    connections: number;
  };
  events: UserEvent[];
  activityLast7Days: UserActivityDay[];
  activityHeatmap: UserActivityDay[]; // Last 6 months
  source: {
    referrer?: string;
    channel?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

// Animal names for anonymous users
const ANIMALS = [
  'Wolf', 'Eagle', 'Lion', 'Tiger', 'Bear', 'Fox', 'Hawk', 'Panther', 'Falcon', 'Jaguar',
  'Raven', 'Phoenix', 'Dragon', 'Serpent', 'Griffin', 'Owl', 'Shark', 'Dolphin', 'Whale', 'Orca'
];

const COLORS = [
  'Azure', 'Crimson', 'Emerald', 'Golden', 'Ivory', 'Jade', 'Coral', 'Silver', 'Amber', 'Violet',
  'Scarlet', 'Cobalt', 'Bronze', 'Indigo', 'Platinum', 'Onyx', 'Ruby', 'Sapphire', 'Topaz', 'Pearl'
];

function generateAnimalName(id: string): string {
  // Generate consistent name from ID hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % COLORS.length;
  const animalIndex = Math.abs(hash >> 8) % ANIMALS.length;
  return `${COLORS[colorIndex]} ${ANIMALS[animalIndex]}`;
}

function categorizeChannel(referrer: string | null, utmSource: string | null, utmMedium: string | null): string {
  if (!referrer && !utmSource) return 'Direct';
  
  const source = (referrer || utmSource || '').toLowerCase();
  const medium = (utmMedium || '').toLowerCase();
  
  if (source.includes('chatgpt') || source.includes('openai') || source.includes('claude') || source.includes('anthropic')) return 'AI';
  if (source.includes('linkedin') || source.includes('twitter') || source.includes('x.com') || source.includes('facebook')) return 'Organic Social';
  if (source.includes('google') && !medium.includes('cpc')) return 'Organic Search';
  if (medium.includes('cpc') || medium.includes('paid')) return 'Paid';
  if (medium.includes('email') || medium.includes('newsletter')) return 'Newsletter';
  if (referrer) return 'Referral';
  
  return 'Direct';
}

function getActivityLevel(pageViews: number): 'none' | 'low' | 'medium' | 'high' {
  if (pageViews === 0) return 'none';
  if (pageViews <= 2) return 'low';
  if (pageViews <= 5) return 'medium';
  return 'high';
}

export function useUserDetail(userId: string | null) {
  return useQuery({
    queryKey: ['user-detail', userId],
    queryFn: async (): Promise<UserDetailData | null> => {
      if (!userId) return null;
      
      const sixMonthsAgo = subDays(new Date(), 180).toISOString();
      
      // Fetch all data in parallel
      const [
        profileResult,
        sessionsResult,
        pageViewsResult,
        connectionsResult,
      ] = await Promise.all([
        // Profile data
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        
        // User sessions
        supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId)
          .gte('started_at', sixMonthsAgo)
          .order('started_at', { ascending: false }),
        
        // Page views
        supabase
          .from('page_views')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', sixMonthsAgo)
          .order('created_at', { ascending: true }),
        
        // Connections
        supabase
          .from('connection_requests')
          .select('id, created_at, listing_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ]);
      
      const profile = profileResult.data;
      const sessions = sessionsResult.data || [];
      const pageViews = pageViewsResult.data || [];
      const connections = connectionsResult.data || [];
      
      // Determine if anonymous
      const isAnonymous = !profile || (!profile.first_name && !profile.last_name);
      const name = isAnonymous 
        ? generateAnimalName(userId) 
        : [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Anonymous';
      
      // Get latest session for geo/tech data
      const latestSession = sessions[0];
      
      // Calculate stats
      const totalPageviews = pageViews.length;
      const totalSessions = new Set(sessions.map(s => s.session_id)).size;
      const totalTimeOnSite = sessions.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0);
      
      const firstSession = sessions[sessions.length - 1];
      const firstSeen = firstSession?.started_at || new Date().toISOString();
      const lastSeen = latestSession?.last_active_at || latestSession?.started_at || new Date().toISOString();
      
      // Time to convert (first session to first connection)
      let timeToConvert: number | undefined;
      if (connections.length > 0 && firstSession) {
        const firstConnectionDate = new Date(connections[0].created_at);
        const firstSessionDate = new Date(firstSession.started_at);
        timeToConvert = differenceInSeconds(firstConnectionDate, firstSessionDate);
      }
      
      // Build event timeline
      const events: UserEvent[] = [];
      
      // Add page views
      pageViews.forEach(pv => {
        events.push({
          id: pv.id,
          type: 'page_view',
          timestamp: pv.created_at,
          title: `Viewed page`,
          path: pv.page_path,
          description: pv.page_path,
        });
      });
      
      // Add connection events
      connections.forEach(c => {
        events.push({
          id: c.id,
          type: 'event',
          timestamp: c.created_at,
          title: 'Sent connection request',
          description: `Connection request submitted`,
          metadata: { listingId: c.listing_id },
        });
      });
      
      // Sort by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Build activity for last 7 days
      const last7Days: UserActivityDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayViews = pageViews.filter(pv => format(new Date(pv.created_at), 'yyyy-MM-dd') === dateStr).length;
        last7Days.push({
          date: dateStr,
          pageViews: dayViews,
          level: getActivityLevel(dayViews),
        });
      }
      
      // Build activity heatmap for last 6 months
      const activityHeatmap: UserActivityDay[] = [];
      for (let i = 180; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayViews = pageViews.filter(pv => format(new Date(pv.created_at), 'yyyy-MM-dd') === dateStr).length;
        activityHeatmap.push({
          date: dateStr,
          pageViews: dayViews,
          level: getActivityLevel(dayViews),
        });
      }
      
      return {
        profile: {
          id: userId,
          name,
          email: profile?.email,
          company: profile?.company,
          buyerType: profile?.buyer_type,
          isAnonymous,
        },
        geo: {
          country: latestSession?.country || 'Unknown',
          city: latestSession?.city || 'Unknown',
        },
        tech: {
          device: latestSession?.device_type || 'Desktop',
          os: latestSession?.os || 'Unknown',
          browser: latestSession?.browser || 'Unknown',
        },
        stats: {
          totalPageviews,
          totalSessions,
          totalTimeOnSite,
          firstSeen,
          lastSeen,
          timeToConvert,
          connections: connections.length,
        },
        events,
        activityLast7Days: last7Days,
        activityHeatmap,
        source: {
          referrer: firstSession?.referrer,
          channel: categorizeChannel(firstSession?.referrer, firstSession?.utm_source, firstSession?.utm_medium),
          utmSource: firstSession?.utm_source,
          utmMedium: firstSession?.utm_medium,
          utmCampaign: firstSession?.utm_campaign,
        },
      };
    },
    enabled: !!userId,
    staleTime: 30000,
  });
}
