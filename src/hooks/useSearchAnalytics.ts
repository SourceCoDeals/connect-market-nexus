import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface SearchAnalyticsData {
  // Top search queries
  topQueries: Array<{
    query: string;
    count: number;
    avgResults: number;
    clickRate: number;
  }>;
  
  // Zero result searches
  zeroResultSearches: Array<{
    query: string;
    count: number;
  }>;
  
  // Filter usage
  filterUsage: Array<{
    filter: string;
    count: number;
    percentage: number;
  }>;
  
  // Search metrics
  totalSearches: number;
  avgResultsPerSearch: number;
  zeroResultRate: number;
  avgTimeToClick: number;
}

export function useSearchAnalytics(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['search-analytics', timeRangeDays],
    queryFn: async (): Promise<SearchAnalyticsData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      const { data: searches, error } = await supabase
        .from('search_analytics')
        .select('search_query, filters_applied, results_count, time_to_click, created_at')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      const searchData = searches || [];
      
      // Aggregate queries
      const queryStats: Record<string, { count: number; totalResults: number; clicks: number }> = {};
      const zeroResultQueries: Record<string, number> = {};
      const filterCounts: Record<string, number> = {};
      let totalTimeToClick = 0;
      let clickCount = 0;
      
      searchData.forEach(search => {
        const query = (search.search_query || '').toLowerCase().trim();
        if (!query) return;
        
        if (!queryStats[query]) {
          queryStats[query] = { count: 0, totalResults: 0, clicks: 0 };
        }
        queryStats[query].count += 1;
        queryStats[query].totalResults += search.results_count || 0;
        
        if (search.time_to_click !== null && search.time_to_click > 0) {
          queryStats[query].clicks += 1;
          totalTimeToClick += search.time_to_click;
          clickCount += 1;
        }
        
        // Track zero results
        if (search.results_count === 0) {
          zeroResultQueries[query] = (zeroResultQueries[query] || 0) + 1;
        }
        
        // Track filters
        if (search.filters_applied && typeof search.filters_applied === 'object') {
          const filters = search.filters_applied as Record<string, any>;
          Object.keys(filters).forEach(filterKey => {
            if (filters[filterKey] !== null && filters[filterKey] !== undefined && filters[filterKey] !== '') {
              filterCounts[filterKey] = (filterCounts[filterKey] || 0) + 1;
            }
          });
        }
      });
      
      // Build top queries
      const topQueries = Object.entries(queryStats)
        .map(([query, stats]) => ({
          query,
          count: stats.count,
          avgResults: stats.count > 0 ? Math.round((stats.totalResults / stats.count) * 10) / 10 : 0,
          clickRate: stats.count > 0 ? (stats.clicks / stats.count) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      // Build zero result searches
      const zeroResultSearches = Object.entries(zeroResultQueries)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Build filter usage
      const totalFiltersUsed = Object.values(filterCounts).reduce((sum, v) => sum + v, 0);
      const filterUsage = Object.entries(filterCounts)
        .map(([filter, count]) => ({
          filter: formatFilterName(filter),
          count,
          percentage: totalFiltersUsed > 0 ? (count / totalFiltersUsed) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
      
      // Calculate metrics
      const totalSearches = searchData.length;
      const totalResults = searchData.reduce((sum, s) => sum + (s.results_count || 0), 0);
      const zeroResultCount = searchData.filter(s => s.results_count === 0).length;
      
      return {
        topQueries,
        zeroResultSearches,
        filterUsage,
        totalSearches,
        avgResultsPerSearch: totalSearches > 0 ? Math.round((totalResults / totalSearches) * 10) / 10 : 0,
        zeroResultRate: totalSearches > 0 ? (zeroResultCount / totalSearches) * 100 : 0,
        avgTimeToClick: clickCount > 0 ? Math.round(totalTimeToClick / clickCount) : 0,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

function formatFilterName(filter: string): string {
  const nameMap: Record<string, string> = {
    category: 'Category',
    location: 'Location',
    revenueMin: 'Min Revenue',
    revenueMax: 'Max Revenue',
    askingPriceMin: 'Min Price',
    askingPriceMax: 'Max Price',
    businessType: 'Business Type',
  };
  return nameMap[filter] || filter.charAt(0).toUpperCase() + filter.slice(1);
}
