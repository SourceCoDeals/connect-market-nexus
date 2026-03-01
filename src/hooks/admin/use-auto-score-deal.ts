/**
 * Hook that automatically ensures a deal has buyer scores.
 *
 * Every deal should have recommended buyers. This hook:
 * 1. Detects when a deal has no scores in remarketing_scores
 * 2. Auto-assigns the deal to ALL active buyer universes (not just one)
 * 3. Queues scoring against every universe so every buyer gets evaluated
 * 4. Polls for progress and refreshes the recommended buyers list when done
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AutoScoreStatus =
  | 'idle'
  | 'checking'
  | 'assigning_universes'
  | 'queuing'
  | 'scoring'
  | 'done'
  | 'error'
  | 'no_universes';

interface AutoScoreState {
  status: AutoScoreStatus;
  message: string;
  progress: number;
  error?: string;
}

export function useAutoScoreDeal(listingId: string | undefined, hasScores: boolean | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AutoScoreState>({
    status: 'idle',
    message: '',
    progress: 0,
  });
  const triggeredRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if scoring is already queued/in-progress for this deal
  const { data: queueStatus } = useQuery({
    queryKey: ['remarketing', 'queue-status', listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scoring_queue')
        .select('status')
        .eq('listing_id', listingId!)
        .in('status', ['pending', 'processing']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!listingId && hasScores === false,
    refetchInterval: state.status === 'scoring' ? 3000 : false,
  });

  // Poll for new scores during scoring
  useEffect(() => {
    if (state.status === 'scoring' && listingId) {
      pollingRef.current = setInterval(async () => {
        const { count } = await supabase
          .from('remarketing_scores')
          .select('*', { count: 'exact', head: true })
          .eq('listing_id', listingId);

        if (count && count > 0) {
          setState({ status: 'done', message: `${count} buyers scored`, progress: 100 });
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
        }
      }, 4000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
      };
    }
  }, [state.status, listingId, queryClient]);

  // Detect if scoring is already in progress (from a prior visit or manual trigger)
  useEffect(() => {
    if (queueStatus && queueStatus.length > 0 && state.status === 'idle' && hasScores === false) {
      setState({
        status: 'scoring',
        message: `Scoring in progress (${queueStatus.length} queued)`,
        progress: 30,
      });
    }
  }, [queueStatus, state.status, hasScores]);

  const triggerAutoScore = useCallback(async () => {
    if (!listingId || triggeredRef.current) return;
    triggeredRef.current = true;

    try {
      setState({ status: 'checking', message: 'Preparing buyer scoring...', progress: 10 });

      // Step 1: Get all active universes
      const { data: allUniverses, error: uError } = await supabase
        .from('remarketing_buyer_universes')
        .select('id, name')
        .eq('archived', false);

      if (uError) throw uError;
      if (!allUniverses || allUniverses.length === 0) {
        setState({ status: 'no_universes', message: 'No buyer universes exist yet', progress: 0 });
        return;
      }

      // Step 2: Check which universes this deal is already linked to
      const { data: existingLinks } = await supabase
        .from('remarketing_universe_deals')
        .select('universe_id')
        .eq('listing_id', listingId)
        .eq('status', 'active');

      const linkedIds = new Set((existingLinks || []).map((l) => l.universe_id));
      const unlinkedUniverses = allUniverses.filter((u) => !linkedIds.has(u.id));

      // Step 3: Auto-assign to all unlinked universes
      if (unlinkedUniverses.length > 0) {
        setState({
          status: 'assigning_universes',
          message: `Linking to ${unlinkedUniverses.length} buyer universe(s)...`,
          progress: 30,
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        const rows = unlinkedUniverses.map((u) => ({
          universe_id: u.id,
          listing_id: listingId,
          added_by: user?.id,
          status: 'active' as const,
        }));

        // Insert in batches to avoid size limits
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error: assignError } = await supabase
            .from('remarketing_universe_deals')
            .upsert(batch, { onConflict: 'universe_id,listing_id', ignoreDuplicates: true });
          if (assignError) {
            console.warn(
              '[useAutoScoreDeal] Some universe assignments failed:',
              assignError.message,
            );
          }
        }
      }

      // Step 4: Queue scoring against ALL universes (linked + newly linked)
      const allUniverseIds = allUniverses.map((u) => u.id);
      setState({
        status: 'queuing',
        message: `Queuing scoring across ${allUniverseIds.length} universe(s)...`,
        progress: 50,
      });

      const { queueDealScoring } = await import('@/lib/remarketing/queueScoring');
      let totalQueued = 0;
      for (const uid of allUniverseIds) {
        try {
          totalQueued += await queueDealScoring({ universeId: uid, listingIds: [listingId] });
        } catch (err) {
          console.warn(`[useAutoScoreDeal] Failed to queue for universe ${uid}:`, err);
        }
      }

      if (totalQueued === 0) {
        // Already queued or completed — check if scores exist now
        const { count } = await supabase
          .from('remarketing_scores')
          .select('*', { count: 'exact', head: true })
          .eq('listing_id', listingId);

        if (count && count > 0) {
          setState({ status: 'done', message: `${count} buyers already scored`, progress: 100 });
          queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
          return;
        }
      }

      // Step 5: Switch to polling mode
      setState({
        status: 'scoring',
        message: `Scoring buyers across ${allUniverseIds.length} universe(s)...`,
        progress: 60,
      });
    } catch (err) {
      console.error('[useAutoScoreDeal] Error:', err);
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Scoring failed',
        progress: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [listingId, queryClient]);

  // Reset when listingId changes
  useEffect(() => {
    return () => {
      triggeredRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [listingId]);

  return {
    ...state,
    triggerAutoScore,
    isAutoScoring: ['checking', 'assigning_universes', 'queuing', 'scoring'].includes(state.status),
  };
}
