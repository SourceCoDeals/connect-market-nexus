import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface DailyMetric {
  date: string;
  totalUsers: number;
  newSignups: number;
  activeUsers: number;
  returningUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  pageViews: number;
  uniquePageViews: number;
  newListings: number;
  listingViews: number;
  connectionRequests: number;
  successfulConnections: number;
  searchesPerformed: number;
  conversionRate: number;
}

export interface HistoricalMetricsData {
  metrics: DailyMetric[];
  
  // Week-over-week comparisons
  weekOverWeek: {
    users: { current: number; previous: number; change: number };
    sessions: { current: number; previous: number; change: number };
    pageViews: { current: number; previous: number; change: number };
    conversions: { current: number; previous: number; change: number };
  };
  
  // Aggregated totals for the period
  totals: {
    totalUsers: number;
    totalSessions: number;
    totalPageViews: number;
    totalConnections: number;
    avgBounceRate: number;
    avgSessionDuration: number;
  };
  
  // Trend data for charts
  trendData: {
    users: Array<{ date: string; value: number }>;
    sessions: Array<{ date: string; value: number }>;
    pageViews: Array<{ date: string; value: number }>;
    conversions: Array<{ date: string; value: number }>;
  };
}

export function useHistoricalMetrics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['historical-metrics', timeRangeDays],
    queryFn: async (): Promise<HistoricalMetricsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch daily metrics
      const { data: dailyMetrics, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      const metrics: DailyMetric[] = (dailyMetrics || []).map(m => ({
        date: m.date,
        totalUsers: m.total_users || 0,
        newSignups: m.new_signups || 0,
        activeUsers: m.active_users || 0,
        returningUsers: m.returning_users || 0,
        totalSessions: m.total_sessions || 0,
        avgSessionDuration: m.avg_session_duration || 0,
        bounceRate: m.bounce_rate || 0,
        pageViews: m.page_views || 0,
        uniquePageViews: m.unique_page_views || 0,
        newListings: m.new_listings || 0,
        listingViews: m.listing_views || 0,
        connectionRequests: m.connection_requests || 0,
        successfulConnections: m.successful_connections || 0,
        searchesPerformed: m.searches_performed || 0,
        conversionRate: m.conversion_rate || 0,
      }));
      
      // Calculate week-over-week
      const midpoint = Math.floor(metrics.length / 2);
      const currentWeek = metrics.slice(midpoint);
      const previousWeek = metrics.slice(0, midpoint);
      
      const sumField = (arr: DailyMetric[], field: keyof DailyMetric): number => 
        arr.reduce((sum, m) => sum + (Number(m[field]) || 0), 0);
      
      const calculateChange = (current: number, previous: number): number => 
        previous > 0 ? ((current - previous) / previous) * 100 : 0;
      
      const weekOverWeek = {
        users: {
          current: sumField(currentWeek, 'activeUsers'),
          previous: sumField(previousWeek, 'activeUsers'),
          change: calculateChange(
            sumField(currentWeek, 'activeUsers'),
            sumField(previousWeek, 'activeUsers')
          ),
        },
        sessions: {
          current: sumField(currentWeek, 'totalSessions'),
          previous: sumField(previousWeek, 'totalSessions'),
          change: calculateChange(
            sumField(currentWeek, 'totalSessions'),
            sumField(previousWeek, 'totalSessions')
          ),
        },
        pageViews: {
          current: sumField(currentWeek, 'pageViews'),
          previous: sumField(previousWeek, 'pageViews'),
          change: calculateChange(
            sumField(currentWeek, 'pageViews'),
            sumField(previousWeek, 'pageViews')
          ),
        },
        conversions: {
          current: sumField(currentWeek, 'successfulConnections'),
          previous: sumField(previousWeek, 'successfulConnections'),
          change: calculateChange(
            sumField(currentWeek, 'successfulConnections'),
            sumField(previousWeek, 'successfulConnections')
          ),
        },
      };
      
      // Calculate totals
      const totals = {
        totalUsers: sumField(metrics, 'totalUsers'),
        totalSessions: sumField(metrics, 'totalSessions'),
        totalPageViews: sumField(metrics, 'pageViews'),
        totalConnections: sumField(metrics, 'successfulConnections'),
        avgBounceRate: metrics.length > 0 
          ? sumField(metrics, 'bounceRate') / metrics.length 
          : 0,
        avgSessionDuration: metrics.length > 0 
          ? sumField(metrics, 'avgSessionDuration') / metrics.length 
          : 0,
      };
      
      // Trend data
      const trendData = {
        users: metrics.map(m => ({ date: m.date, value: m.activeUsers })),
        sessions: metrics.map(m => ({ date: m.date, value: m.totalSessions })),
        pageViews: metrics.map(m => ({ date: m.date, value: m.pageViews })),
        conversions: metrics.map(m => ({ date: m.date, value: m.successfulConnections })),
      };
      
      return {
        metrics,
        weekOverWeek,
        totals,
        trendData,
      };
    },
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // 10 minutes
  });
}
