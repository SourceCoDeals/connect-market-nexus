import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DealAnalytics {
  deal_id: string;
  engagement_score: number;
  stage_velocity: number;
  days_in_current_stage: number;
  probability_trend: 'increasing' | 'decreasing' | 'stable';
  risk_level: 'low' | 'medium' | 'high';
  next_action_suggestion: string;
  similar_deals_closed: number;
  average_close_time: number;
  conversion_likelihood: number;
}

export interface DealInsights {
  total_interactions: number;
  last_interaction_days: number;
  document_status_score: number;
  response_rate: number;
  urgency_indicators: string[];
  competitive_pressure: 'low' | 'medium' | 'high';
  budget_confidence: number;
  decision_maker_engaged: boolean;
}

export function useDealAnalytics(dealId?: string) {
  return useQuery({
    queryKey: ['deal-analytics', dealId],
    queryFn: async (): Promise<DealAnalytics | null> => {
      if (!dealId) return null;
      
      // Mock analytics data - in real implementation, this would come from sophisticated analysis
      return {
        deal_id: dealId,
        engagement_score: Math.floor(Math.random() * 40) + 60, // 60-100
        stage_velocity: Math.floor(Math.random() * 30) + 10, // 10-40 days average
        days_in_current_stage: Math.floor(Math.random() * 20) + 1,
        probability_trend: ['increasing', 'decreasing', 'stable'][Math.floor(Math.random() * 3)] as any,
        risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        next_action_suggestion: 'Follow up on NDA status and schedule discovery call',
        similar_deals_closed: Math.floor(Math.random() * 5) + 2,
        average_close_time: Math.floor(Math.random() * 30) + 45, // 45-75 days
        conversion_likelihood: Math.floor(Math.random() * 30) + 70 // 70-100%
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDealInsights(dealId?: string) {
  return useQuery({
    queryKey: ['deal-insights', dealId],
    queryFn: async (): Promise<DealInsights | null> => {
      if (!dealId) return null;
      
      // Mock insights data
      return {
        total_interactions: Math.floor(Math.random() * 10) + 5,
        last_interaction_days: Math.floor(Math.random() * 7) + 1,
        document_status_score: Math.floor(Math.random() * 40) + 60,
        response_rate: Math.floor(Math.random() * 30) + 70,
        urgency_indicators: [
          'Mentioned Q4 deadline',
          'Looking to close soon',
          'Competitor evaluation ongoing'
        ].slice(0, Math.floor(Math.random() * 3) + 1),
        competitive_pressure: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        budget_confidence: Math.floor(Math.random() * 30) + 70,
        decision_maker_engaged: Math.random() > 0.3
      };
    },
    enabled: !!dealId,
    staleTime: 5 * 60 * 1000,
  });
}