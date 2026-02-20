import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export interface UserSession {
  session_id: string;
  timestamp: string;
  event_count: number;
  formatted_time: string;
}

export const useUserSessions = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-sessions", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch page views with session data
      const { data: pageViews } = await supabase
        .from("page_views")
        .select("session_id, created_at")
        .eq("user_id", userId)
        .not("session_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch listing analytics with session data
      const { data: listingAnalytics } = await supabase
        .from("listing_analytics")
        .select("session_id, created_at")
        .eq("user_id", userId)
        .not("session_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      // Fetch user events with session data
      const { data: userEvents } = await supabase
        .from("user_events")
        .select("session_id, created_at")
        .eq("user_id", userId)
        .not("session_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      // Combine all session data
      const allSessions = [
        ...(pageViews || []),
        ...(listingAnalytics || []),
        ...(userEvents || []),
      ];

      // Group by session_id and count events
      const sessionMap = new Map<string, { timestamp: string; count: number }>();

      allSessions.forEach((item) => {
        if (item.session_id) {
          const existing = sessionMap.get(item.session_id);
          if (existing) {
            // Keep the earliest timestamp
            if (new Date(item.created_at) < new Date(existing.timestamp)) {
              existing.timestamp = item.created_at;
            }
            existing.count++;
          } else {
            sessionMap.set(item.session_id, {
              timestamp: item.created_at,
              count: 1,
            });
          }
        }
      });

      // Convert to array and format
      const sessions: UserSession[] = Array.from(sessionMap.entries())
        .map(([session_id, data]) => ({
          session_id,
          timestamp: data.timestamp,
          event_count: data.count,
          formatted_time: formatDistanceToNow(new Date(data.timestamp), {
            addSuffix: true,
          }),
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20); // Keep most recent 20 sessions

      return sessions;
    },
    enabled: !!userId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (was 10s)
  });
};
