import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserSegment {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  engagement_score: number;
  last_active: string;
  total_views: number;
  total_saves: number;
  total_connections: number;
  churn_risk: 'low' | 'medium' | 'high';
}

interface SearchInsight {
  search_query: string;
  search_count: number;
  conversion_rate: number;
  avg_results: number;
  no_results_rate: number;
}

export function useUserBehaviorAnalytics(daysBack: number = 30) {
  return useQuery({
    queryKey: ['user-behavior-analytics', daysBack],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get high-value users (high engagement, haven't connected recently)
      const { data: highValueUsers } = await supabase
        .from('engagement_scores')
        .select(`
          user_id,
          score,
          last_active,
          listings_viewed,
          listings_saved,
          connections_requested,
          profiles!engagement_scores_user_id_fkey(email, first_name, last_name)
        `)
        .gte('score', 70)
        .order('score', { ascending: false })
        .limit(20);

      // Get users at risk of churning (declining activity)
      const { data: churnRiskUsers } = await supabase
        .from('engagement_scores')
        .select(`
          user_id,
          score,
          last_active,
          listings_viewed,
          listings_saved,
          connections_requested,
          profiles!engagement_scores_user_id_fkey(email, first_name, last_name)
        `)
        .lt('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .gte('score', 40)
        .order('last_active', { ascending: true })
        .limit(15);

      // Get search analytics
      const { data: searchData } = await supabase
        .from('search_analytics')
        .select('search_query, results_count, results_clicked, no_results')
        .gte('created_at', startDate.toISOString());

      // Process search insights
      const searchMap = new Map();
      
      searchData?.forEach(item => {
        const query = item.search_query.toLowerCase();
        if (!searchMap.has(query)) {
          searchMap.set(query, {
            search_query: query,
            search_count: 0,
            total_results: 0,
            clicks: 0,
            no_results_count: 0
          });
        }
        
        const search = searchMap.get(query);
        search.search_count++;
        search.total_results += item.results_count || 0;
        search.clicks += item.results_clicked || 0;
        if (item.no_results) search.no_results_count++;
      });

      const searchInsights: SearchInsight[] = Array.from(searchMap.values())
        .map(search => ({
          search_query: search.search_query,
          search_count: search.search_count,
          conversion_rate: search.search_count > 0 ? (search.clicks / search.search_count) * 100 : 0,
          avg_results: search.search_count > 0 ? search.total_results / search.search_count : 0,
          no_results_rate: search.search_count > 0 ? (search.no_results_count / search.search_count) * 100 : 0
        }))
        .filter(search => search.search_count >= 5) // Only include searches with at least 5 occurrences
        .sort((a, b) => b.search_count - a.search_count)
        .slice(0, 10);

      // Get peak usage hours
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('started_at')
        .gte('started_at', startDate.toISOString());

      const hourlyActivity = new Array(24).fill(0);
      sessionData?.forEach(session => {
        const hour = new Date(session.started_at).getHours();
        hourlyActivity[hour]++;
      });

      const peakHours = hourlyActivity
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ hour, count }) => ({
          timeRange: `${hour}:00 - ${hour + 1}:00`,
          activity: count > hourlyActivity.reduce((a, b) => a + b, 0) / 24 * 1.5 ? 'High' : 
                   count > hourlyActivity.reduce((a, b) => a + b, 0) / 24 ? 'Medium' : 'Low',
          count
        }));

      // Process user segments
      const processUserSegment = (users: any[], type: 'high-value' | 'churn-risk'): UserSegment[] => {
        return users?.map(user => {
          const daysSinceActive = user.last_active ? 
            Math.floor((Date.now() - new Date(user.last_active).getTime()) / (1000 * 60 * 60 * 24)) : 999;
          
          return {
            user_id: user.user_id,
            email: user.profiles?.email || 'Unknown',
            first_name: user.profiles?.first_name || '',
            last_name: user.profiles?.last_name || '',
            engagement_score: user.score,
            last_active: user.last_active,
            total_views: user.listings_viewed,
            total_saves: user.listings_saved,
            total_connections: user.connections_requested,
            churn_risk: daysSinceActive > 14 ? 'high' : daysSinceActive > 7 ? 'medium' : 'low'
          };
        }) || [];
      };

      return {
        highValueUsers: processUserSegment(highValueUsers, 'high-value'),
        churnRiskUsers: processUserSegment(churnRiskUsers, 'churn-risk'),
        searchInsights,
        peakHours,
        totalSearches: searchData?.length || 0,
        uniqueSearchTerms: searchMap.size
      };
    },
    refetchInterval: 300000, // 5 minutes
  });
}