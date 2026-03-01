/**
 * Hook that automatically ensures a deal has buyer scores.
 *
 * Every deal should have recommended buyers. This hook:
 * 1. Detects when a deal has no scores in remarketing_scores
 * 2. Auto-assigns the deal to ALL active buyer universes
 * 3. Assigns orphan buyers (no universe) to the primary universe so they get scored
 * 4. Imports marketplace buyers (connection_requests) into remarketing_buyers
 * 5. Queues scoring FIRST (most important step — don't block on discovery)
 * 6. Discovers new potential buyers via Google search (non-blocking, with timeout)
 * 7. Polls for progress and refreshes the recommended buyers list when done
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AutoScoreStatus =
  | 'idle'
  | 'checking'
  | 'assigning_universes'
  | 'importing_buyers'
  | 'discovering'
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

/** Wrap a promise with a timeout. Rejects with TimeoutError after `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
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

      const allUniverseIds = allUniverses.map((u) => u.id);
      const primaryUniverseId = allUniverseIds[0];

      // Step 2: Link deal to all universes
      const { data: existingLinks } = await supabase
        .from('remarketing_universe_deals')
        .select('universe_id')
        .eq('listing_id', listingId)
        .eq('status', 'active');

      const linkedIds = new Set((existingLinks || []).map((l) => l.universe_id));
      const unlinkedUniverses = allUniverses.filter((u) => !linkedIds.has(u.id));

      if (unlinkedUniverses.length > 0) {
        setState({
          status: 'assigning_universes',
          message: `Linking deal to ${unlinkedUniverses.length} buyer universe(s)...`,
          progress: 15,
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

        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error: assignError } = await supabase
            .from('remarketing_universe_deals')
            .upsert(batch, { onConflict: 'universe_id,listing_id', ignoreDuplicates: true });
          if (assignError) {
            console.warn('[useAutoScoreDeal] Universe assignment failed:', assignError.message);
          }
        }
      }

      // Step 3: Assign orphan buyers (no universe_id) to primary universe
      setState({
        status: 'importing_buyers',
        message: 'Checking for unassigned buyers...',
        progress: 25,
      });

      const { count: orphanCount } = await supabase
        .from('remarketing_buyers')
        .select('*', { count: 'exact', head: true })
        .is('universe_id', null)
        .eq('archived', false);

      if (orphanCount && orphanCount > 0) {
        setState({
          status: 'importing_buyers',
          message: `Assigning ${orphanCount} unlinked buyer(s) to scoring universe...`,
          progress: 30,
        });

        // Batch update orphans
        let assigned = 0;
        while (assigned < orphanCount) {
          const { data: orphanBatch } = await supabase
            .from('remarketing_buyers')
            .select('id')
            .is('universe_id', null)
            .eq('archived', false)
            .limit(500);

          if (!orphanBatch || orphanBatch.length === 0) break;

          await supabase
            .from('remarketing_buyers')
            .update({ universe_id: primaryUniverseId })
            .in(
              'id',
              orphanBatch.map((b) => b.id),
            );

          assigned += orphanBatch.length;
        }
      }

      // Step 4: Import marketplace buyers not yet in remarketing system
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
                progress: 35,
              });

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
                    universe_id: primaryUniverseId,
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

      // Step 5: Queue scoring FIRST — this is the critical path
      // Don't wait for Google discovery before queuing existing buyers
      setState({
        status: 'queuing',
        message: `Queuing scoring across all buyers in ${allUniverseIds.length} universe(s)...`,
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

      // Step 6: Switch to polling mode — scoring is running
      setState({
        status: 'scoring',
        message: 'Scoring all buyers — this runs in the background...',
        progress: 65,
      });

      // Step 7: Google discovery runs AFTER scoring is queued, with a 15s timeout
      // This is non-blocking — scoring is already in progress
      try {
        const { data: listing } = await supabase
          .from('listings')
          .select(
            'title, category, categories, location, address_state, industry, services, revenue, number_of_locations',
          )
          .eq('id', listingId)
          .single();

        if (listing) {
          const industry =
            listing.industry ||
            listing.category ||
            (listing.categories as string[] | null)?.[0] ||
            '';
          const geography = listing.address_state || listing.location || '';
          const services = (listing.services as string[] | null)?.join(', ') || '';
          const revenueHint = listing.revenue
            ? `$${(listing.revenue / 1_000_000).toFixed(1)}M revenue`
            : '';
          const locationHint = listing.number_of_locations
            ? `${listing.number_of_locations}+ locations`
            : '';

          const queryParts = [
            industry && `${industry} companies`,
            services && `offering ${services}`,
            geography && `in ${geography}`,
            revenueHint,
            locationHint,
            'acquisitions OR "looking to acquire" OR "platform company"',
          ].filter(Boolean);
          const searchQuery = queryParts.join(' ');

          // 15-second timeout — if discovery hangs, scoring still proceeds
          const discoveryPromise = supabase.functions.invoke('discover-companies', {
            body: {
              query: searchQuery,
              industry: industry || undefined,
              geography: geography || undefined,
              min_locations: listing.number_of_locations || undefined,
              max_results: 15,
            },
          });

          const { data: discoveryResult, error: discoverError } = await withTimeout(
            discoveryPromise,
            15_000,
            'Google discovery',
          );

          if (discoverError) {
            console.warn('[useAutoScoreDeal] Google discovery failed:', discoverError.message);
          } else if (discoveryResult?.companies?.length > 0) {
            const newCompanies = discoveryResult.companies.filter(
              (c: { already_in_db: boolean }) => !c.already_in_db,
            );

            if (newCompanies.length > 0) {
              const buyersToInsert = newCompanies.map(
                (c: {
                  name: string;
                  url?: string;
                  description?: string;
                  industry?: string;
                  location?: string;
                }) => ({
                  company_name: c.name,
                  company_website: c.url || null,
                  business_summary: c.description || null,
                  industry_vertical: c.industry || industry || null,
                  hq_state: c.location || geography || null,
                  universe_id: primaryUniverseId,
                  notes: `Auto-discovered via Google search for deal: ${listing.title}`,
                  extraction_sources: JSON.stringify({
                    source: 'google_discover',
                    deal_id: listingId,
                    discovered_at: new Date().toISOString(),
                    search_query: searchQuery,
                  }),
                }),
              );

              for (let i = 0; i < buyersToInsert.length; i += 25) {
                const batch = buyersToInsert.slice(i, i + 25);
                await supabase.from('remarketing_buyers').insert(batch as never);
              }

              // Re-queue scoring for the primary universe to pick up newly discovered buyers
              await queueDealScoring({
                universeId: primaryUniverseId,
                listingIds: [listingId],
              }).catch(() => {});
            }
          }
        }
      } catch (discoverErr) {
        // Discovery is non-fatal — scoring is already running
        console.warn('[useAutoScoreDeal] Google discovery skipped:', discoverErr);
      }
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
    isAutoScoring: [
      'checking',
      'assigning_universes',
      'importing_buyers',
      'queuing',
      'scoring',
    ].includes(state.status),
  };
}
