import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface ExitAnalysisData {
  // Exit page ranking
  exitPageRanking: Array<{
    pagePath: string;
    pageLabel: string;
    exitCount: number;
    exitPercentage: number;
  }>;
  
  // Exit by journey stage
  exitByStage: Array<{
    stage: string;
    exitCount: number;
    percentage: number;
  }>;
  
  // Exit correlation with non-conversion
  exitVsConversion: {
    exitedWithoutConversion: number;
    exitedAfterConversion: number;
    noExitTracked: number;
  };
  
  // Top exit pages by category
  exitByCategory: Array<{
    category: string;
    exitCount: number;
    topExitPage: string;
  }>;
  
  // Summary stats
  totalExits: number;
  avgPagesBeforeExit: number;
  bounceRate: number;
}

export function useExitAnalysis(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['exit-analysis', timeRangeDays],
    queryFn: async (): Promise<ExitAnalysisData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch page views with exit data
      const { data: pageViews, error: pvError } = await supabase
        .from('page_views')
        .select('page_path, exit_page, session_id, user_id, created_at')
        .gte('created_at', startDate.toISOString());
      
      if (pvError) throw pvError;
      
      // Fetch connection requests for conversion correlation
      const { data: conversions, error: convError } = await supabase
        .from('connection_requests')
        .select('user_id')
        .gte('created_at', startDate.toISOString());
      
      if (convError) throw convError;
      
      const views = pageViews || [];
      const convertedUsers = new Set((conversions || []).map(c => c.user_id));
      
      // Exit page ranking
      const exitCounts: Record<string, number> = {};
      let totalExits = 0;
      
      views.forEach(v => {
        if (v.exit_page === true) {
          const path = v.page_path || '/unknown';
          exitCounts[path] = (exitCounts[path] || 0) + 1;
          totalExits++;
        }
      });
      
      const exitPageRanking = Object.entries(exitCounts)
        .map(([pagePath, exitCount]) => ({
          pagePath,
          pageLabel: formatPageLabel(pagePath),
          exitCount,
          exitPercentage: totalExits > 0 ? (exitCount / totalExits) * 100 : 0,
        }))
        .sort((a, b) => b.exitCount - a.exitCount)
        .slice(0, 10);
      
      // Exit by journey stage
      const stageCounts: Record<string, number> = {
        'Landing': 0,
        'Browsing': 0,
        'Search': 0,
        'Listing Detail': 0,
        'Conversion Flow': 0,
        'Other': 0,
      };
      
      views.forEach(v => {
        if (v.exit_page === true) {
          const path = v.page_path || '';
          if (path === '/' || path === '/home') {
            stageCounts['Landing']++;
          } else if (path.includes('/search') || path.includes('/category')) {
            stageCounts['Search']++;
          } else if (path.includes('/listing/')) {
            stageCounts['Listing Detail']++;
          } else if (path.includes('/connection') || path.includes('/request')) {
            stageCounts['Conversion Flow']++;
          } else if (path.includes('/browse') || path.includes('/explore')) {
            stageCounts['Browsing']++;
          } else {
            stageCounts['Other']++;
          }
        }
      });
      
      const totalStageExits = Object.values(stageCounts).reduce((a, b) => a + b, 0);
      const exitByStage = Object.entries(stageCounts)
        .map(([stage, exitCount]) => ({
          stage,
          exitCount,
          percentage: totalStageExits > 0 ? (exitCount / totalStageExits) * 100 : 0,
        }))
        .filter(s => s.exitCount > 0)
        .sort((a, b) => b.exitCount - a.exitCount);
      
      // Exit vs conversion correlation
      const sessionUsers: Record<string, string | null> = {};
      const sessionHasExit: Set<string> = new Set();
      
      views.forEach(v => {
        if (v.session_id) {
          sessionUsers[v.session_id] = v.user_id;
          if (v.exit_page === true) {
            sessionHasExit.add(v.session_id);
          }
        }
      });
      
      let exitedWithoutConversion = 0;
      let exitedAfterConversion = 0;
      let noExitTracked = 0;
      
      Object.entries(sessionUsers).forEach(([sessionId, userId]) => {
        const hasExit = sessionHasExit.has(sessionId);
        const converted = userId ? convertedUsers.has(userId) : false;
        
        if (hasExit && !converted) {
          exitedWithoutConversion++;
        } else if (hasExit && converted) {
          exitedAfterConversion++;
        } else {
          noExitTracked++;
        }
      });
      
      const exitVsConversion = {
        exitedWithoutConversion,
        exitedAfterConversion,
        noExitTracked,
      };
      
      // Exit by category (for listing pages)
      const categoryExits: Record<string, { count: number; pages: Record<string, number> }> = {};
      
      views.forEach(v => {
        if (v.exit_page === true && v.page_path?.includes('/listing/')) {
          // Extract category from path if possible
          const category = extractCategory(v.page_path) || 'Unknown';
          
          if (!categoryExits[category]) {
            categoryExits[category] = { count: 0, pages: {} };
          }
          categoryExits[category].count++;
          categoryExits[category].pages[v.page_path] = (categoryExits[category].pages[v.page_path] || 0) + 1;
        }
      });
      
      const exitByCategory = Object.entries(categoryExits)
        .map(([category, data]) => {
          const topPage = Object.entries(data.pages).sort((a, b) => b[1] - a[1])[0];
          return {
            category,
            exitCount: data.count,
            topExitPage: topPage ? topPage[0] : 'N/A',
          };
        })
        .sort((a, b) => b.exitCount - a.exitCount)
        .slice(0, 5);
      
      // Calculate additional metrics
      const sessionPageCounts: Record<string, number> = {};
      views.forEach(v => {
        if (v.session_id) {
          sessionPageCounts[v.session_id] = (sessionPageCounts[v.session_id] || 0) + 1;
        }
      });
      
      const sessionsWithExit = Object.keys(sessionPageCounts).filter(s => sessionHasExit.has(s));
      const avgPagesBeforeExit = sessionsWithExit.length > 0
        ? Math.round(sessionsWithExit.reduce((sum, s) => sum + sessionPageCounts[s], 0) / sessionsWithExit.length * 10) / 10
        : 0;
      
      // Bounce rate (sessions with only 1 page view)
      const totalSessions = Object.keys(sessionPageCounts).length;
      const bouncedSessions = Object.values(sessionPageCounts).filter(c => c === 1).length;
      const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
      
      return {
        exitPageRanking,
        exitByStage,
        exitVsConversion,
        exitByCategory,
        totalExits,
        avgPagesBeforeExit,
        bounceRate,
      };
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });
}

function formatPageLabel(path: string): string {
  if (!path || path === '/') return 'Home';
  
  // Clean up common paths
  const cleanPath = path.replace(/^\//, '').replace(/\/$/, '');
  
  if (cleanPath.startsWith('listing/')) return 'Listing Detail';
  if (cleanPath.startsWith('search')) return 'Search Results';
  if (cleanPath.startsWith('category')) return 'Category Page';
  if (cleanPath.startsWith('saved')) return 'Saved Listings';
  if (cleanPath.startsWith('connection')) return 'Connection Request';
  if (cleanPath.startsWith('profile')) return 'Profile';
  if (cleanPath.startsWith('settings')) return 'Settings';
  
  // Capitalize first letter
  return cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1);
}

function extractCategory(path: string): string | null {
  // This would need to be enhanced based on actual URL structure
  // For now, return null and let it be "Unknown"
  return null;
}
