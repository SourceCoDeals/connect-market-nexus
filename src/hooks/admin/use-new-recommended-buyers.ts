import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

export interface BuyerScore {
  buyer_id: string;
  company_name: string;
  pe_firm_name: string | null;
  buyer_type: string | null;
  hq_state: string | null;
  hq_city: string | null;
  has_fee_agreement: boolean;
  acquisition_appetite: string | null;
  composite_score: number;
  service_score: number;
  geography_score: number;
  size_score: number;
  bonus_score: number;
  fit_signals: string[];
  tier: 'move_now' | 'strong' | 'speculative';
  source: 'scored' | 'marketplace' | 'pipeline';
}

export interface RecommendedBuyersResult {
  buyers: BuyerScore[];
  total: number;
  cached: boolean;
  scored_at: string;
}

export function useNewRecommendedBuyers(listingId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<RecommendedBuyersResult>({
    queryKey: ['new-recommended-buyers', listingId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('score-deal-buyers', {
        body: { listingId },
      });
      if (error) throw error;
      return data as RecommendedBuyersResult;
    },
    enabled: !!listingId,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours — matches server cache
    retry: 1,
  });

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('score-deal-buyers', {
      body: { listingId, forceRefresh: true },
    });
    if (error) throw error;
    queryClient.setQueryData(['new-recommended-buyers', listingId], data);
    return data as RecommendedBuyersResult;
  }, [listingId, queryClient]);

  return { ...query, refresh };
}
