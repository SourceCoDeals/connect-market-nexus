/**
 * Hook that automatically ensures a deal has buyer scores.
 *
 * Every deal should have recommended buyers. This hook:
 * 1. Detects when a deal has no scores in remarketing_scores
 * 2. Queues scoring for each universe the deal is ALREADY assigned to
 *    (does NOT auto-assign deals to universes — that's a manual admin action)
 * 3. Imports marketplace buyers (connection_requests) into remarketing_buyers
 * 4. Polls for progress and refreshes the recommended buyers list when done
 *
 * IMPORTANT: This hook must NEVER modify universe-deal assignments.
 * Universe assignments are a deliberate admin decision. The recommendation
 * panel only recommends buyers for accept/reject — it does not control
 * which universes a deal belongs to.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AutoScoreStatus =
  | 'idle'
  | 'checking'
  | 'importing_buyers'
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
  const pollCountRef = useRef(0);
  const initialScoreCountRef = useRef<number | null>(null);
  const MAX_POLL_ATTEMPTS = 45; // 45 * 4s = 3 minutes max

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
    if (state.status !== 'scoring' || !listingId) {
      return undefined;
    }

    pollCountRef.current = 0;

    // Capture initial score count so we can detect NEW scores (not just pre-existing ones)
    const captureInitialCount = async () => {
      if (initialScoreCountRef.current === null) {
        const { count } = await supabase
          .from('remarketing_scores')
          .select('*', { count: 'exact', head: true })
          .eq('listing_id', listingId);
        initialScoreCountRef.current = count ?? 0;
      }
    };
    captureInitialCount();

    pollingRef.current = setInterval(async () => {
      pollCountRef.current++;

      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        setState({
          status: 'error',
          message: 'Scoring timed out. It may still be running in the background — try refreshing.',
          progress: 0,
          error: 'Polling timeout',
        });
        // Allow retry by resetting triggeredRef
        triggeredRef.current = false;
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['recommended-buyers', listingId] });
        return;
      }

      const { count } = await supabase
        .from('remarketing_scores')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId);

      const initialCount = initialScoreCountRef.current ?? 0;
      // Detect new scores: either first scores appeared, or count increased from when we started
      if (count && count > 0 && count > initialCount) {
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
      setState({ status: 'checking', message: 'Preparing buyer scoring...', progress: 5 });

      // Step 1: Find which universes this deal is ALREADY assigned to.
      // We do NOT auto-assign deals to universes — that's a manual admin decision.
      const { data: existingLinks } = await supabase
        .from('remarketing_universe_deals')
        .select('universe_id')
        .eq('listing_id', listingId)
        .eq('status', 'active');

      const linkedUniverseIds = (existingLinks || []).map((l) => l.universe_id);

      if (linkedUniverseIds.length === 0) {
        // Deal isn't assigned to any universe yet — that's fine, admin needs to do it.
        // Show a helpful message instead of force-assigning.
        setState({
          status: 'no_universes',
          message: 'This deal has not been assigned to a buyer universe yet.',
          progress: 0,
        });
        triggeredRef.current = false;
        return;
      }

      // Step 2: Import marketplace buyers not yet in remarketing system
      try {
        const { data: connections } = await supabase
          .from('connection_requests')
          .select('user_id, lead_company, lead_name, lead_email')
          .eq('listing_id', listingId)
          .in('status', ['approved', 'converted', 'pending', 'followed_up']);

        if (connections && connections.length > 0) {
          const userIds = connections.map((c) => c.user_id).filter((id): id is string => !!id);

          if (userIds.length > 0) {
            const { data: unlinkedProfiles } = await supabase
              .from('profiles')
              .select('id, company_name, buyer_type, first_name, last_name')
              .in('id', userIds)
              .is('remarketing_buyer_id', null);

            if (unlinkedProfiles && unlinkedProfiles.length > 0) {
              setState({
                status: 'importing_buyers',
                message: `Importing ${unlinkedProfiles.length} marketplace buyer(s)...`,
                progress: 20,
              });

              // Use the first linked universe for new marketplace buyers
              const targetUniverseId = linkedUniverseIds[0];

              for (const profile of unlinkedProfiles) {
                const companyName =
                  profile.company_name ||
                  `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                  'Marketplace Buyer';

                const { data: inserted } = await supabase
                  .from('remarketing_buyers')
                  .insert({
                    company_name: companyName,
                    buyer_type: profile.buyer_type || null,
                    universe_id: targetUniverseId,
                    notes: `Auto-imported from marketplace interest (listing ${listingId})`,
                  } as never)
                  .select('id')
                  .single();

                if (inserted) {
                  await supabase
                    .from('profiles')
                    .update({ remarketing_buyer_id: inserted.id })
                    .eq('id', profile.id);
                }
              }
            }
          }
        }
      } catch (marketplaceErr) {
        console.warn('[useAutoScoreDeal] Marketplace import failed (non-fatal):', marketplaceErr);
      }

      // Step 3: Queue scoring for ONLY the universes this deal is already assigned to
      setState({
        status: 'queuing',
        message: `Queuing scoring for ${linkedUniverseIds.length} assigned universe(s)...`,
        progress: 50,
      });

      const { queueDealScoring } = await import('@/lib/remarketing/queueScoring');
      let totalQueued = 0;
      for (const uid of linkedUniverseIds) {
        try {
          totalQueued += await queueDealScoring({ universeId: uid, listingIds: [listingId] });
        } catch (err) {
          console.warn(`[useAutoScoreDeal] Failed to queue for universe ${uid}:`, err);
        }
      }

      if (totalQueued === 0) {
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

      // Step 4: Switch to polling mode — scoring is running
      setState({
        status: 'scoring',
        message: 'Scoring buyers in assigned universes — this runs in the background...',
        progress: 65,
      });
    } catch (err) {
      console.error('[useAutoScoreDeal] Error:', err);
      // Reset triggeredRef so the user can retry
      triggeredRef.current = false;
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
      initialScoreCountRef.current = null;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [listingId]);

  return {
    ...state,
    triggerAutoScore,
    isAutoScoring: ['checking', 'importing_buyers', 'queuing', 'scoring'].includes(state.status),
  };
}
