import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserJourney {
  id: string;
  visitor_id: string;
  ga4_client_id: string | null;
  user_id: string | null;
  first_seen_at: string;
  first_landing_page: string | null;
  first_referrer: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_device_type: string | null;
  first_browser: string | null;
  first_os: string | null;
  first_country: string | null;
  first_city: string | null;
  last_seen_at: string;
  last_session_id: string | null;
  last_page_path: string | null;
  total_sessions: number;
  total_page_views: number;
  total_time_seconds: number;
  milestones: Record<string, string>;
  journey_stage: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyStats {
  totalJourneys: number;
  anonymous: number;
  registered: number;
  engaged: number;
  qualified: number;
  converted: number;
  avgSessionsToConvert: number;
  avgTimeToRegister: number;
  topSources: { source: string; count: number }[];
  topLandingPages: { page: string; count: number }[];
}

export function useUserJourneys(timeRangeDays: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRangeDays);
  const startDateStr = startDate.toISOString();

  const { data: journeys, isLoading, error, refetch } = useQuery({
    queryKey: ['user-journeys', timeRangeDays],
    queryFn: async (): Promise<UserJourney[]> => {
      const { data, error } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('is_bot', false)
        .eq('is_production', true)
        .gte('first_seen_at', startDateStr)
        .order('last_seen_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data || []) as UserJourney[];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (was 30s)
  });

  // Calculate stats
  const stats: JourneyStats = {
    totalJourneys: journeys?.length || 0,
    anonymous: journeys?.filter(j => j.journey_stage === 'anonymous').length || 0,
    registered: journeys?.filter(j => j.journey_stage === 'registered').length || 0,
    engaged: journeys?.filter(j => j.journey_stage === 'engaged').length || 0,
    qualified: journeys?.filter(j => j.journey_stage === 'qualified').length || 0,
    converted: journeys?.filter(j => j.journey_stage === 'converted').length || 0,
    avgSessionsToConvert: 0,
    avgTimeToRegister: 0,
    topSources: [],
    topLandingPages: [],
  };

  if (journeys && journeys.length > 0) {
    // Calculate average sessions to convert
    const convertedJourneys = journeys.filter(j => j.journey_stage === 'converted');
    if (convertedJourneys.length > 0) {
      const totalSessions = convertedJourneys.reduce((sum, j) => sum + j.total_sessions, 0);
      stats.avgSessionsToConvert = Math.round(totalSessions / convertedJourneys.length * 10) / 10;
    }

    // Calculate average time to register (hours)
    const registeredJourneys = journeys.filter(j => j.milestones?.signup_at);
    if (registeredJourneys.length > 0) {
      const totalHours = registeredJourneys.reduce((sum, j) => {
        const firstSeen = new Date(j.first_seen_at).getTime();
        const signupAt = new Date(j.milestones.signup_at).getTime();
        return sum + (signupAt - firstSeen) / (1000 * 60 * 60);
      }, 0);
      stats.avgTimeToRegister = Math.round(totalHours / registeredJourneys.length * 10) / 10;
    }

    // Top sources
    const sourceCounts: Record<string, number> = {};
    journeys.forEach(j => {
      const source = j.first_utm_source || (j.first_referrer ? 'Referral' : 'Direct');
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    stats.topSources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top landing pages
    const pageCounts: Record<string, number> = {};
    journeys.forEach(j => {
      const page = j.first_landing_page || '/';
      pageCounts[page] = (pageCounts[page] || 0) + 1;
    });
    stats.topLandingPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return { 
    journeys: journeys || [], 
    stats, 
    isLoading, 
    error, 
    refetch 
  };
}

export function useJourneyDetail(visitorId: string) {
  return useQuery({
    queryKey: ['journey-detail', visitorId],
    queryFn: async () => {
      // Get journey record
      const { data: journey, error: journeyError } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('visitor_id', visitorId)
        .single();

      if (journeyError) throw journeyError;

      // Get all sessions for this visitor
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', journey?.last_session_id || '')
        .order('started_at', { ascending: true });

      // Get page views from sessions
      const { data: pageViews } = await supabase
        .from('page_views')
        .select('*')
        .eq('session_id', journey?.last_session_id || '')
        .order('viewed_at', { ascending: true });

      return {
        journey,
        sessions: sessions || [],
        pageViews: pageViews || [],
      };
    },
    enabled: !!visitorId,
  });
}
