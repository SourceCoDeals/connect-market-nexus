import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DealStage } from './types';

export function useDealStages(includeClosedStages = true) {
  return useQuery({
    queryKey: ['deal-stages', includeClosedStages],
    queryFn: async () => {
      let query = supabase.from('deal_stages').select('*').eq('is_active', true);

      // Filter out closed stages unless explicitly requested
      if (!includeClosedStages) {
        query = query.eq('stage_type', 'active');
      }

      const { data, error } = await query.order('position');
      if (error) throw error;
      return data as DealStage[];
    },
  });
}

// Get deal count for a stage using the DB function
export function useStageDealCount(stageId: string | undefined) {
  return useQuery({
    queryKey: ['stage-deal-count', stageId],
    queryFn: async () => {
      if (!stageId) return 0;

      const { data, error } = await supabase.rpc('get_stage_deal_count', { stage_uuid: stageId });

      if (error) {
        throw error;
      }

      return data as number;
    },
    enabled: !!stageId,
  });
}
