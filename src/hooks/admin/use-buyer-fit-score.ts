import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BuyerFitScoreResult {
  profile_id: string;
  total_score: number;
  tier: number;
  algorithmic_tier: number;
  admin_override: number | null;
  component_breakdown: {
    buyer_type: number;
    platform_signal: number;
    capital_credibility: number;
    profile_completeness: number;
  };
  platform_signal_detected: boolean;
  platform_signal_source: 'message' | 'profile' | 'enrichment' | null;
  platform_keywords_matched: string[];
  buyer_type_used: string;
  calculated_at: string;
}

/**
 * Hook to recalculate buyer fit score for a single profile.
 * Calls the calculate-buyer-fit-score edge function.
 */
export function useRecalculateBuyerFitScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      dealRequestMessage,
      connectionRequestId,
    }: {
      profileId: string;
      dealRequestMessage?: string;
      connectionRequestId?: string;
    }): Promise<BuyerFitScoreResult> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('calculate-buyer-fit-score', {
        body: {
          profile_id: profileId,
          deal_request_message: dealRequestMessage || null,
          connection_request_id: connectionRequestId || null,
        },
      });

      if (error) throw error;
      return data as BuyerFitScoreResult;
    },
    onSuccess: (data) => {
      toast.success(`Score updated: ${data.total_score}/100 (Tier ${data.tier})`);
      // Invalidate queries that display buyer data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-users'] });
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (error) => {
      toast.error(`Failed to calculate score: ${error.message}`);
    },
  });
}

/**
 * Hook to batch-calculate buyer fit scores for all buyers.
 */
export function useBatchCalculateBuyerFitScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: 'all' | 'unscored' = 'unscored') => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('calculate-buyer-fit-score', {
        body: { calculate_all: mode === 'all' ? true : 'unscored' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Batch scoring complete');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-users'] });
    },
    onError: (error) => {
      toast.error(`Batch scoring failed: ${error.message}`);
    },
  });
}

/**
 * Hook to set or clear admin tier override for a buyer.
 */
export function useAdminTierOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      tierOverride,
      overrideNote,
    }: {
      profileId: string;
      tierOverride: number | null;
      overrideNote?: string;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          admin_tier_override: tierOverride,
          admin_override_note: overrideNote || null,
          // Also update the effective tier
          buyer_fit_tier: tierOverride,
        })
        .eq('id', profileId);

      if (error) throw error;

      return { profileId, tierOverride };
    },
    onSuccess: ({ tierOverride }) => {
      if (tierOverride) {
        toast.success(`Tier manually set to Tier ${tierOverride}`);
      } else {
        toast.success('Admin override removed — algorithmic tier restored');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-users'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (error) => {
      toast.error(`Failed to update tier: ${error.message}`);
    },
  });
}

export type { BuyerFitScoreResult };
