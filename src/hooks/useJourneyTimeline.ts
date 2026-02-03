import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserJourney } from "./useUserJourneys";

export interface TimelinePageView {
  id: string;
  page_path: string;
  page_title: string | null;
  viewed_at: string;
  time_on_page: number | null;
  scroll_depth: number | null;
  session_id: string;
}

export interface TimelineSession {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
  page_views: TimelinePageView[];
  events: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  event_action: string;
  event_category: string | null;
  event_label: string | null;
  page_path: string | null;
  created_at: string;
}

export interface JourneyTimeline {
  journey: UserJourney;
  sessions: TimelineSession[];
  milestones: { key: string; timestamp: string }[];
}

export interface PathSequence {
  path: string;
  count: number;
  percentage: number;
}

export interface SourceCohort {
  source: string;
  totalVisitors: number;
  registered: number;
  registeredRate: number;
  qualified: number;
  qualifiedRate: number;
  converted: number;
  convertedRate: number;
  avgSessions: number;
  avgHoursToConvert: number | null;
}

export interface MilestoneTimings {
  milestone: string;
  avgHours: number;
  medianHours: number;
  minHours: number;
  maxHours: number;
  count: number;
}

export function useJourneyTimeline(visitorId: string | null) {
  return useQuery({
    queryKey: ['journey-timeline', visitorId],
    queryFn: async (): Promise<JourneyTimeline | null> => {
      if (!visitorId) return null;

      // Get the journey record
      const { data: journey, error: journeyError } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('visitor_id', visitorId)
        .single();

      if (journeyError || !journey) {
        console.error('Journey not found:', journeyError);
        return null;
      }

      // Get sessions for this user (if user_id is linked) or by last_session_id
      // Filter out bot sessions
      let sessionsQuery = supabase
        .from('user_sessions')
        .select('*')
        .eq('is_bot', false)
        .order('started_at', { ascending: true });

      if (journey.user_id) {
        sessionsQuery = sessionsQuery.eq('user_id', journey.user_id);
      } else if (journey.last_session_id) {
        sessionsQuery = sessionsQuery.eq('session_id', journey.last_session_id);
      }

      const { data: sessions } = await sessionsQuery.limit(50);
      const sessionIds = sessions?.map(s => s.session_id) || [];

      // Get page views for all sessions
      const { data: pageViews } = sessionIds.length > 0
        ? await supabase
            .from('page_views')
            .select('id, page_path, page_title, created_at, time_on_page, scroll_depth, session_id')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true })
        : { data: [] };

      // Get user events for all sessions
      const { data: events } = sessionIds.length > 0
        ? await supabase
            .from('user_events')
            .select('id, event_action, event_category, event_label, page_path, created_at, session_id')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true })
        : { data: [] };

      // Build timeline sessions
      const timelineSessions: TimelineSession[] = (sessions || []).map(session => {
        // Calculate duration from timestamps if not available
        const startTime = new Date(session.started_at).getTime();
        const endTime = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
        const durationSeconds = Math.floor((endTime - startTime) / 1000);

        return {
          session_id: session.session_id,
          started_at: session.started_at,
          ended_at: session.ended_at,
          duration_seconds: durationSeconds,
          device_type: session.device_type,
          browser: session.browser,
          os: session.os,
          referrer: session.referrer,
          country: session.country,
          city: session.city,
          page_views: (pageViews || [])
            .filter(pv => pv.session_id === session.session_id)
            .map(pv => ({
              id: pv.id,
            page_path: pv.page_path,
            page_title: pv.page_title,
            viewed_at: pv.created_at,
            time_on_page: pv.time_on_page,
            scroll_depth: pv.scroll_depth,
            session_id: pv.session_id,
          })),
        events: (events || [])
          .filter(e => e.session_id === session.session_id)
          .map(e => ({
            id: e.id,
            event_action: e.event_action,
            event_category: e.event_category,
            event_label: e.event_label,
            page_path: e.page_path,
            created_at: e.created_at,
          })),
        };
      });

      // Extract milestones from JSONB
      const milestones: { key: string; timestamp: string }[] = [];
      const milestonesData = journey.milestones as Record<string, string> | null;
      if (milestonesData) {
        Object.entries(milestonesData).forEach(([key, timestamp]) => {
          if (timestamp) {
            milestones.push({ key, timestamp });
          }
        });
        milestones.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }

      return {
        journey: journey as unknown as UserJourney,
        sessions: timelineSessions,
        milestones,
      };
    },
    enabled: !!visitorId,
  });
}

// Calculate path analysis from journeys
export function calculatePathAnalysis(
  journeys: UserJourney[],
  pageViewsBySession: Map<string, string[]>
): PathSequence[] {
  const pathCounts = new Map<string, number>();
  let totalPaths = 0;

  // For each journey, get page sequence and extract 3-step paths
  journeys.forEach(journey => {
    const pages = pageViewsBySession.get(journey.last_session_id || '') || [];
    
    // Normalize paths (remove IDs, keep first 3 steps)
    const normalizedPages = pages.slice(0, 5).map(p => {
      if (p.match(/\/listing\/[a-f0-9-]+/)) return '/listing/*';
      if (p.match(/\/[a-f0-9-]{36}/)) return '/*';
      return p;
    });

    // Create path sequences (up to 3 steps)
    for (let len = 2; len <= Math.min(3, normalizedPages.length); len++) {
      const sequence = normalizedPages.slice(0, len).join(' → ');
      pathCounts.set(sequence, (pathCounts.get(sequence) || 0) + 1);
      totalPaths++;
    }
  });

  // Convert to sorted array
  const paths = Array.from(pathCounts.entries())
    .map(([path, count]) => ({
      path,
      count,
      percentage: totalPaths > 0 ? (count / journeys.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return paths;
}

// Calculate source cohort metrics
export function calculateSourceCohorts(journeys: UserJourney[]): SourceCohort[] {
  const cohortMap = new Map<string, {
    visitors: UserJourney[];
    registered: number;
    qualified: number;
    converted: number;
    totalSessions: number;
    conversionHours: number[];
  }>();

  journeys.forEach(journey => {
    const source = journey.first_utm_source || 
      (journey.first_referrer ? 'Referral' : 'Direct');
    
    if (!cohortMap.has(source)) {
      cohortMap.set(source, {
        visitors: [],
        registered: 0,
        qualified: 0,
        converted: 0,
        totalSessions: 0,
        conversionHours: [],
      });
    }

    const cohort = cohortMap.get(source)!;
    cohort.visitors.push(journey);
    cohort.totalSessions += journey.total_sessions;

    if (['registered', 'engaged', 'qualified', 'converted'].includes(journey.journey_stage)) {
      cohort.registered++;
    }
    if (['qualified', 'converted'].includes(journey.journey_stage)) {
      cohort.qualified++;
    }
    if (journey.journey_stage === 'converted') {
      cohort.converted++;
      // Calculate time to convert
      const firstSeen = new Date(journey.first_seen_at).getTime();
      const milestones = journey.milestones as Record<string, string> | null;
      if (milestones?.first_connection_at) {
        const convertedAt = new Date(milestones.first_connection_at).getTime();
        cohort.conversionHours.push((convertedAt - firstSeen) / (1000 * 60 * 60));
      }
    }
  });

  return Array.from(cohortMap.entries())
    .map(([source, data]) => ({
      source,
      totalVisitors: data.visitors.length,
      registered: data.registered,
      registeredRate: data.visitors.length > 0 ? (data.registered / data.visitors.length) * 100 : 0,
      qualified: data.qualified,
      qualifiedRate: data.visitors.length > 0 ? (data.qualified / data.visitors.length) * 100 : 0,
      converted: data.converted,
      convertedRate: data.visitors.length > 0 ? (data.converted / data.visitors.length) * 100 : 0,
      avgSessions: data.visitors.length > 0 ? data.totalSessions / data.visitors.length : 0,
      avgHoursToConvert: data.conversionHours.length > 0 
        ? data.conversionHours.reduce((a, b) => a + b, 0) / data.conversionHours.length 
        : null,
    }))
    .sort((a, b) => b.totalVisitors - a.totalVisitors);
}

// Calculate milestone timing metrics
export function calculateMilestoneTimings(journeys: UserJourney[]): MilestoneTimings[] {
  const timings: Record<string, number[]> = {
    signup: [],
    nda_signed: [],
    fee_agreement: [],
    first_connection: [],
  };

  journeys.forEach(journey => {
    const firstSeen = new Date(journey.first_seen_at).getTime();
    const milestones = journey.milestones as Record<string, string> | null;

    if (milestones) {
      if (milestones.signup_at) {
        const hours = (new Date(milestones.signup_at).getTime() - firstSeen) / (1000 * 60 * 60);
        if (hours >= 0) timings.signup.push(hours);
      }
      if (milestones.nda_signed_at) {
        const hours = (new Date(milestones.nda_signed_at).getTime() - firstSeen) / (1000 * 60 * 60);
        if (hours >= 0) timings.nda_signed.push(hours);
      }
      if (milestones.fee_agreement_at) {
        const hours = (new Date(milestones.fee_agreement_at).getTime() - firstSeen) / (1000 * 60 * 60);
        if (hours >= 0) timings.fee_agreement.push(hours);
      }
      if (milestones.first_connection_at) {
        const hours = (new Date(milestones.first_connection_at).getTime() - firstSeen) / (1000 * 60 * 60);
        if (hours >= 0) timings.first_connection.push(hours);
      }
    }
  });

  const milestoneLabels: Record<string, string> = {
    signup: 'First Visit → Signup',
    nda_signed: 'First Visit → NDA Signed',
    fee_agreement: 'First Visit → Fee Agreement',
    first_connection: 'First Visit → Connection',
  };

  return Object.entries(timings)
    .filter(([_, values]) => values.length > 0)
    .map(([key, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        milestone: milestoneLabels[key] || key,
        avgHours: values.reduce((a, b) => a + b, 0) / values.length,
        medianHours: sorted[Math.floor(sorted.length / 2)],
        minHours: sorted[0],
        maxHours: sorted[sorted.length - 1],
        count: values.length,
      };
    });
}
