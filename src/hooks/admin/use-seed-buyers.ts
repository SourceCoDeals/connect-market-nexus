import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SeedBuyerResult {
  buyer_id: string;
  company_name: string;
  action: 'inserted' | 'enriched_existing' | 'probable_duplicate' | 'cached';
  why_relevant: string;
  was_new_record: boolean;
}

export interface SeedBuyersResponse {
  seeded_buyers: SeedBuyerResult[];
  total: number;
  inserted?: number;
  enriched_existing?: number;
  probable_duplicates?: number;
  cached: boolean;
  seeded_at: string;
  cache_key: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface SeedBuyersParams {
  listingId: string;
  maxBuyers?: number;
  forceRefresh?: boolean;
}

export function useSeedBuyers() {
  const queryClient = useQueryClient();

  return useMutation<SeedBuyersResponse, Error, SeedBuyersParams>({
    mutationFn: async ({ listingId, maxBuyers, forceRefresh }) => {
      const { data, error } = await supabase.functions.invoke('seed-buyers', {
        body: { listingId, maxBuyers, forceRefresh },
      });
      if (error) throw error;
      return data as SeedBuyersResponse;
    },
    onSuccess: (_data, variables) => {
      // Invalidate recommended buyers so the list refreshes with newly seeded buyers
      queryClient.invalidateQueries({
        queryKey: ['new-recommended-buyers', variables.listingId],
      });
    },
  });
}
