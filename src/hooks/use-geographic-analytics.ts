import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface GeographicAnalyticsData {
  // Country-level data
  countryBreakdown: Array<{
    country: string;
    countryCode: string;
    sessions: number;
    uniqueUsers: number;
    avgDuration: number;
    percentage: number;
  }>;
  
  // City-level data (top cities)
  cityBreakdown: Array<{
    city: string;
    country: string;
    sessions: number;
  }>;
  
  // Timezone distribution
  timezoneDistribution: Array<{
    timezone: string;
    count: number;
    percentage: number;
  }>;
  
  // Region aggregates (for US map)
  usRegions: Array<{
    region: string;
    sessions: number;
  }>;
  
  // Summary stats
  totalCountries: number;
  totalCities: number;
  topCountry: string;
  domesticPercentage: number;
}

export function useGeographicAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['geographic-analytics', timeRangeDays],
    queryFn: async (): Promise<GeographicAnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch session geo data
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('id, user_id, country, country_code, city, region, timezone, session_duration_seconds')
        .gte('created_at', startDate.toISOString())
        .not('country', 'is', null);
      
      if (error) throw error;
      const sessionData = sessions || [];
      
      // Aggregate by country
      const countryStats: Record<string, { 
        sessions: number; 
        users: Set<string>; 
        totalDuration: number;
        countryCode: string;
      }> = {};
      
      sessionData.forEach(s => {
        const country = s.country || 'Unknown';
        if (!countryStats[country]) {
          countryStats[country] = { 
            sessions: 0, 
            users: new Set(), 
            totalDuration: 0,
            countryCode: s.country_code || '',
          };
        }
        countryStats[country].sessions += 1;
        if (s.user_id) countryStats[country].users.add(s.user_id);
        countryStats[country].totalDuration += s.session_duration_seconds || 0;
      });
      
      const totalSessions = sessionData.length;
      
      const countryBreakdown = Object.entries(countryStats)
        .map(([country, stats]) => ({
          country,
          countryCode: stats.countryCode,
          sessions: stats.sessions,
          uniqueUsers: stats.users.size,
          avgDuration: stats.sessions > 0 
            ? Math.round(stats.totalDuration / stats.sessions) 
            : 0,
          percentage: totalSessions > 0 
            ? (stats.sessions / totalSessions) * 100 
            : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);
      
      // Aggregate by city
      const cityStats: Record<string, { sessions: number; country: string }> = {};
      sessionData.forEach(s => {
        if (s.city) {
          const key = `${s.city}, ${s.country}`;
          if (!cityStats[key]) {
            cityStats[key] = { sessions: 0, country: s.country || '' };
          }
          cityStats[key].sessions += 1;
        }
      });
      
      const cityBreakdown = Object.entries(cityStats)
        .map(([key, stats]) => ({
          city: key.split(', ')[0],
          country: stats.country,
          sessions: stats.sessions,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20);
      
      // Timezone distribution
      const timezoneStats: Record<string, number> = {};
      sessionData.forEach(s => {
        if (s.timezone) {
          timezoneStats[s.timezone] = (timezoneStats[s.timezone] || 0) + 1;
        }
      });
      
      const totalWithTimezone = Object.values(timezoneStats).reduce((a, b) => a + b, 0);
      const timezoneDistribution = Object.entries(timezoneStats)
        .map(([timezone, count]) => ({
          timezone,
          count,
          percentage: totalWithTimezone > 0 ? (count / totalWithTimezone) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // US regions (for US sessions only)
      const usRegionStats: Record<string, number> = {};
      sessionData
        .filter(s => s.country === 'United States' && s.region)
        .forEach(s => {
          usRegionStats[s.region!] = (usRegionStats[s.region!] || 0) + 1;
        });
      
      const usRegions = Object.entries(usRegionStats)
        .map(([region, sessions]) => ({ region, sessions }))
        .sort((a, b) => b.sessions - a.sessions);
      
      // Summary stats
      const uniqueCountries = new Set(sessionData.map(s => s.country).filter(Boolean));
      const uniqueCities = new Set(sessionData.map(s => s.city).filter(Boolean));
      const usCount = sessionData.filter(s => s.country === 'United States').length;
      
      return {
        countryBreakdown,
        cityBreakdown,
        timezoneDistribution,
        usRegions,
        totalCountries: uniqueCountries.size,
        totalCities: uniqueCities.size,
        topCountry: countryBreakdown[0]?.country || 'N/A',
        domesticPercentage: totalSessions > 0 ? (usCount / totalSessions) * 100 : 0,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
