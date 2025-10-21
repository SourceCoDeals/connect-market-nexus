import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDescription, getEventIcon, getMostFrequentEvents } from "@/lib/session-event-utils";

export interface SessionEvent {
  id: string;
  timestamp: string;
  source: 'page_view' | 'user_event' | 'listing_analytics';
  type: string;
  description: string;
  icon: string;
  metadata?: {
    page_path?: string;
    page_title?: string;
    element_id?: string;
    element_class?: string;
    listing_id?: string;
    event_label?: string;
    event_action?: string;
    event_category?: string;
  };
}

export const useSessionEvents = (sessionId: string | null, userId: string | null) => {
  return useQuery({
    queryKey: ["session-events", sessionId, userId],
    queryFn: async () => {
      if (!sessionId || !userId) return null;

      // Fetch page views
      const { data: pageViews } = await supabase
        .from("page_views")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // Fetch user events
      const { data: userEvents } = await supabase
        .from("user_events")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // Fetch listing analytics
      const { data: listingAnalytics } = await supabase
        .from("listing_analytics")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // Combine all events
      const allEvents: SessionEvent[] = [];

      // Process page views
      if (pageViews) {
        pageViews.forEach((pv) => {
          allEvents.push({
            id: pv.id,
            timestamp: pv.created_at,
            source: 'page_view',
            type: 'view',
            description: formatEventDescription('page_view', pv),
            icon: getEventIcon('page_view', null, null),
            metadata: {
              page_path: pv.page_path,
              page_title: pv.page_title,
            },
          });
        });
      }

      // Process user events
      if (userEvents) {
        userEvents.forEach((ue) => {
          allEvents.push({
            id: ue.id,
            timestamp: ue.created_at,
            source: 'user_event',
            type: ue.event_action || ue.event_type,
            description: formatEventDescription('user_event', ue),
            icon: getEventIcon('user_event', ue.event_action, null),
            metadata: {
              event_action: ue.event_action,
              event_category: ue.event_category,
              event_label: ue.event_label,
              page_path: ue.page_path,
              element_id: ue.element_id,
              element_class: ue.element_class,
            },
          });
        });
      }

      // Process listing analytics
      if (listingAnalytics) {
        listingAnalytics.forEach((la) => {
          allEvents.push({
            id: la.id,
            timestamp: la.created_at,
            source: 'listing_analytics',
            type: la.action_type,
            description: formatEventDescription('listing_analytics', la),
            icon: getEventIcon('listing_analytics', null, la.action_type),
            metadata: {
              listing_id: la.listing_id,
            },
          });
        });
      }

      // Sort by timestamp
      allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Calculate session duration in minutes
      let sessionDuration = 0;
      if (allEvents.length > 0) {
        const firstEvent = new Date(allEvents[0].timestamp);
        const lastEvent = new Date(allEvents[allEvents.length - 1].timestamp);
        sessionDuration = Math.round((lastEvent.getTime() - firstEvent.getTime()) / 60000);
      }

      // Check if session is ongoing (last event within 5 minutes)
      const isOngoing = allEvents.length > 0 
        ? (Date.now() - new Date(allEvents[allEvents.length - 1].timestamp).getTime()) < 300000
        : false;

      // Get most frequent events
      const mostFrequent = getMostFrequentEvents(allEvents);

      return {
        events: allEvents,
        sessionDuration,
        isOngoing,
        mostFrequent,
        totalEvents: allEvents.length,
      };
    },
    enabled: !!sessionId && !!userId,
  });
};
