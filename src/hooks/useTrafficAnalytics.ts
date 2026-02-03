import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, getHours, getDay } from "date-fns";

export interface TrafficAnalyticsData {
  // Session volume over time
  sessionVolume: Array<{
    date: string;
    sessions: number;
    uniqueUsers: number;
  }>;
  
  // Device breakdown
  deviceBreakdown: Array<{
    device: string;
    count: number;
    percentage: number;
  }>;
  
  // Browser distribution
  browserDistribution: Array<{
    browser: string;
    count: number;
    percentage: number;
  }>;
  
  // Traffic sources
  trafficSources: Array<{
    source: string;
    sessions: number;
    percentage: number;
  }>;
  
  // Activity heatmap (hour x day)
  activityHeatmap: Array<{
    dayOfWeek: number;
    hour: number;
    count: number;
  }>;
  
  // Summary stats
  totalSessions: number;
  totalUniqueUsers: number;
  avgSessionsPerDay: number;
  peakDay: { date: string; count: number };
  peakHour: number;
  
  // NEW: Session duration stats
  avgSessionDuration: number;
  durationDistribution: {
    under30s: number;
    thirtyToTwo: number;
    twoToFive: number;
    fiveToFifteen: number;
    over15min: number;
  };
  
  // NEW: Geographic data from sessions
  sessionGeography: Array<{
    country: string;
    sessions: number;
    percentage: number;
  }>;
}

export function useTrafficAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['traffic-analytics', timeRangeDays],
    queryFn: async (): Promise<TrafficAnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch all session data including new geo and duration fields
      // Filter out bots and dev traffic
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('id, user_id, device_type, browser, referrer, created_at, country, session_duration_seconds')
        .eq('is_bot', false)
        .eq('is_production', true)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      const sessionData = sessions || [];
      
      // Calculate session volume by day
      const dailyVolume: Record<string, { sessions: number; users: Set<string> }> = {};
      
      sessionData.forEach(session => {
        const dayKey = format(new Date(session.created_at), 'MMM d');
        if (!dailyVolume[dayKey]) {
          dailyVolume[dayKey] = { sessions: 0, users: new Set() };
        }
        dailyVolume[dayKey].sessions += 1;
        if (session.user_id) {
          dailyVolume[dayKey].users.add(session.user_id);
        }
      });
      
      const sessionVolume = Object.entries(dailyVolume).map(([date, data]) => ({
        date,
        sessions: data.sessions,
        uniqueUsers: data.users.size,
      }));
      
      // Device breakdown
      const deviceCounts: Record<string, number> = {};
      sessionData.forEach(session => {
        const device = session.device_type || 'Unknown';
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      });
      
      const totalSessions = sessionData.length;
      const deviceBreakdown = Object.entries(deviceCounts)
        .map(([device, count]) => ({
          device: device.charAt(0).toUpperCase() + device.slice(1),
          count,
          percentage: totalSessions > 0 ? (count / totalSessions) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
      
      // Browser distribution
      const browserCounts: Record<string, number> = {};
      sessionData.forEach(session => {
        let browser = session.browser || 'Unknown';
        // Normalize browser names
        if (browser.toLowerCase().includes('chrome')) browser = 'Chrome';
        else if (browser.toLowerCase().includes('safari')) browser = 'Safari';
        else if (browser.toLowerCase().includes('firefox')) browser = 'Firefox';
        else if (browser.toLowerCase().includes('edge')) browser = 'Edge';
        browserCounts[browser] = (browserCounts[browser] || 0) + 1;
      });
      
      const browserDistribution = Object.entries(browserCounts)
        .map(([browser, count]) => ({
          browser,
          count,
          percentage: totalSessions > 0 ? (count / totalSessions) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      
      // Traffic sources
      const sourceCounts: Record<string, number> = {};
      sessionData.forEach(session => {
        let source = 'Direct';
        if (session.referrer) {
          try {
            const url = new URL(session.referrer);
            source = url.hostname.replace('www.', '');
          } catch {
            source = session.referrer.slice(0, 30);
          }
        }
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      
      const trafficSources = Object.entries(sourceCounts)
        .map(([source, sessions]) => ({
          source,
          sessions,
          percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
      
      // Activity heatmap
      const heatmapData: Record<string, number> = {};
      sessionData.forEach(session => {
        const date = new Date(session.created_at);
        const dayOfWeek = getDay(date);
        const hour = getHours(date);
        const key = `${dayOfWeek}-${hour}`;
        heatmapData[key] = (heatmapData[key] || 0) + 1;
      });
      
      const activityHeatmap: Array<{ dayOfWeek: number; hour: number; count: number }> = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          activityHeatmap.push({
            dayOfWeek: day,
            hour,
            count: heatmapData[`${day}-${hour}`] || 0,
          });
        }
      }
      
      // Calculate summary stats
      const uniqueUsers = new Set(sessionData.map(s => s.user_id).filter(Boolean)).size;
      const avgSessionsPerDay = timeRangeDays > 0 ? totalSessions / timeRangeDays : 0;
      
      // Find peak day
      const peakDayEntry = Object.entries(dailyVolume)
        .sort((a, b) => b[1].sessions - a[1].sessions)[0];
      const peakDay = peakDayEntry 
        ? { date: peakDayEntry[0], count: peakDayEntry[1].sessions }
        : { date: '', count: 0 };
      
      // Find peak hour
      const hourCounts: Record<number, number> = {};
      sessionData.forEach(session => {
        const hour = getHours(new Date(session.created_at));
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const peakHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
      
      // NEW: Session duration analysis
      const sessionsWithDuration = sessionData.filter(s => s.session_duration_seconds != null);
      const totalDuration = sessionsWithDuration.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0);
      const avgSessionDuration = sessionsWithDuration.length > 0 ? totalDuration / sessionsWithDuration.length : 0;
      
      const durationDistribution = {
        under30s: 0,
        thirtyToTwo: 0,
        twoToFive: 0,
        fiveToFifteen: 0,
        over15min: 0,
      };
      
      sessionsWithDuration.forEach(s => {
        const duration = s.session_duration_seconds || 0;
        if (duration < 30) durationDistribution.under30s++;
        else if (duration < 120) durationDistribution.thirtyToTwo++;
        else if (duration < 300) durationDistribution.twoToFive++;
        else if (duration < 900) durationDistribution.fiveToFifteen++;
        else durationDistribution.over15min++;
      });
      
      // NEW: Geographic breakdown from sessions
      const countryCounts: Record<string, number> = {};
      sessionData.forEach(s => {
        if (s.country) {
          countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
        }
      });
      
      const sessionGeography = Object.entries(countryCounts)
        .map(([country, sessions]) => ({
          country,
          sessions,
          percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
      
      return {
        sessionVolume,
        deviceBreakdown,
        browserDistribution,
        trafficSources,
        activityHeatmap,
        totalSessions,
        totalUniqueUsers: uniqueUsers,
        avgSessionsPerDay: Math.round(avgSessionsPerDay),
        peakDay,
        peakHour: Number(peakHour),
        avgSessionDuration,
        durationDistribution,
        sessionGeography,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
