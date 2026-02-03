import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface CampaignAttributionData {
  // Source performance
  sourcePerformance: Array<{
    source: string;
    sessions: number;
    conversions: number;
    conversionRate: number;
  }>;
  
  // Campaign performance
  campaignPerformance: Array<{
    campaign: string;
    source: string;
    sessions: number;
    conversions: number;
    conversionRate: number;
  }>;
  
  // Medium comparison
  mediumComparison: Array<{
    medium: string;
    sessions: number;
    conversions: number;
    conversionRate: number;
  }>;
  
  // Attribution funnel
  attributionFunnel: {
    totalSessions: number;
    withUtm: number;
    withViews: number;
    withConversions: number;
  };
  
  // Top performing combinations
  topCombinations: Array<{
    source: string;
    medium: string;
    campaign: string;
    conversions: number;
    roi: number;
  }>;
}

export function useCampaignAttribution(timeRangeDays: number = 30) {
  return useQuery({
    queryKey: ['campaign-attribution', timeRangeDays],
    queryFn: async (): Promise<CampaignAttributionData> => {
      const now = new Date();
      const startDate = subDays(now, timeRangeDays);
      
      // Fetch sessions with UTM data
      // Filter out bots and dev traffic
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('session_id, user_id, utm_source, utm_medium, utm_campaign, utm_content, created_at')
        .eq('is_bot', false)
        .eq('is_production', true)
        .gte('created_at', startDate.toISOString());
      
      if (sessionsError) throw sessionsError;
      
      // Fetch connection requests (conversions)
      const { data: conversions, error: conversionsError } = await supabase
        .from('connection_requests')
        .select('user_id, created_at')
        .gte('created_at', startDate.toISOString());
      
      if (conversionsError) throw conversionsError;
      
      const sessionData = sessions || [];
      const conversionData = conversions || [];
      
      // Create user conversion set
      const convertedUsers = new Set(conversionData.map(c => c.user_id));
      
      // Source performance
      const sourceStats: Record<string, { sessions: number; conversions: number }> = {};
      sessionData.forEach(s => {
        const source = s.utm_source || 'Direct';
        if (!sourceStats[source]) {
          sourceStats[source] = { sessions: 0, conversions: 0 };
        }
        sourceStats[source].sessions++;
        if (s.user_id && convertedUsers.has(s.user_id)) {
          sourceStats[source].conversions++;
        }
      });
      
      const sourcePerformance = Object.entries(sourceStats)
        .map(([source, stats]) => ({
          source,
          sessions: stats.sessions,
          conversions: stats.conversions,
          conversionRate: stats.sessions > 0 ? (stats.conversions / stats.sessions) * 100 : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
      
      // Campaign performance
      const campaignStats: Record<string, { source: string; sessions: number; conversions: number }> = {};
      sessionData.forEach(s => {
        if (s.utm_campaign) {
          const key = s.utm_campaign;
          if (!campaignStats[key]) {
            campaignStats[key] = { source: s.utm_source || 'Direct', sessions: 0, conversions: 0 };
          }
          campaignStats[key].sessions++;
          if (s.user_id && convertedUsers.has(s.user_id)) {
            campaignStats[key].conversions++;
          }
        }
      });
      
      const campaignPerformance = Object.entries(campaignStats)
        .map(([campaign, stats]) => ({
          campaign,
          source: stats.source,
          sessions: stats.sessions,
          conversions: stats.conversions,
          conversionRate: stats.sessions > 0 ? (stats.conversions / stats.sessions) * 100 : 0,
        }))
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 10);
      
      // Medium comparison
      const mediumStats: Record<string, { sessions: number; conversions: number }> = {};
      sessionData.forEach(s => {
        const medium = s.utm_medium || 'none';
        if (!mediumStats[medium]) {
          mediumStats[medium] = { sessions: 0, conversions: 0 };
        }
        mediumStats[medium].sessions++;
        if (s.user_id && convertedUsers.has(s.user_id)) {
          mediumStats[medium].conversions++;
        }
      });
      
      const mediumComparison = Object.entries(mediumStats)
        .map(([medium, stats]) => ({
          medium: medium === 'none' ? 'None' : medium,
          sessions: stats.sessions,
          conversions: stats.conversions,
          conversionRate: stats.sessions > 0 ? (stats.conversions / stats.sessions) * 100 : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);
      
      // Attribution funnel
      const withUtm = sessionData.filter(s => s.utm_source || s.utm_medium || s.utm_campaign).length;
      const userIds = new Set(sessionData.filter(s => s.user_id).map(s => s.user_id));
      const convertedCount = Array.from(userIds).filter(id => convertedUsers.has(id!)).length;
      
      const attributionFunnel = {
        totalSessions: sessionData.length,
        withUtm,
        withViews: userIds.size,
        withConversions: convertedCount,
      };
      
      // Top performing combinations
      const comboStats: Record<string, { source: string; medium: string; campaign: string; conversions: number }> = {};
      sessionData.forEach(s => {
        if (s.utm_source && s.utm_campaign) {
          const key = `${s.utm_source}|${s.utm_medium || 'none'}|${s.utm_campaign}`;
          if (!comboStats[key]) {
            comboStats[key] = {
              source: s.utm_source,
              medium: s.utm_medium || 'none',
              campaign: s.utm_campaign,
              conversions: 0,
            };
          }
          if (s.user_id && convertedUsers.has(s.user_id)) {
            comboStats[key].conversions++;
          }
        }
      });
      
      const topCombinations = Object.values(comboStats)
        .filter(c => c.conversions > 0)
        .map(c => ({ ...c, roi: c.conversions * 100 })) // Simplified ROI
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 5);
      
      return {
        sourcePerformance,
        campaignPerformance,
        mediumComparison,
        attributionFunnel,
        topCombinations,
      };
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });
}
