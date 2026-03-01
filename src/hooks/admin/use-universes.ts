import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { deleteUniverseWithRelated } from '@/lib/ma-intelligence/cascadeDelete';
import {
  useGlobalGateCheck,
  useGlobalActivityQueue,
} from '@/hooks/remarketing/useGlobalActivityQueue';

// ─── Types ──────────────────────────────────────────────────────────

export type SortField = 'name' | 'buyers' | 'deals' | 'coverage';
export type SortOrder = 'asc' | 'desc';

export interface FlaggedDeal {
  id: string;
  title: string | null;
  internal_company_name: string | null;
  industry: string | null;
  address_state: string | null;
  universe_build_flagged_at: string | null;
  buyer_universe_label: string | null;
  buyer_universe_description: string | null;
  buyer_universe_generated_at: string | null;
  enriched_at: string | null;
  created_at: string | null;
}

export type BuyerStats = Record<
  string,
  { total: number; enriched: number; withTranscripts: number }
>;
export type DealStats = Record<string, number>;

// ─── Queries ────────────────────────────────────────────────────────

export function useUniversesQuery(showArchived: boolean) {
  return useQuery({
    queryKey: ['remarketing', 'universes-with-stats', showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('*')
        .eq('archived', showArchived)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useBuyerStatsQuery() {
  return useQuery({
    queryKey: ['remarketing', 'universe-buyer-stats'],
    queryFn: async () => {
      const { data: buyers, error: buyersError } = await supabase
        .from('remarketing_buyers')
        .select('id, universe_id')
        .eq('archived', false)
        .limit(10000);

      if (buyersError) throw buyersError;

      const { data: transcripts, error: transcriptsError } = await supabase
        .from('buyer_transcripts')
        .select('buyer_id')
        .limit(10000);

      if (transcriptsError) throw transcriptsError;

      const buyersWithTranscripts = new Set(transcripts?.map((t) => t.buyer_id) || []);

      const stats: BuyerStats = {};
      buyers?.forEach((buyer) => {
        if (!buyer.universe_id) return;
        if (!stats[buyer.universe_id]) {
          stats[buyer.universe_id] = { total: 0, enriched: 0, withTranscripts: 0 };
        }
        stats[buyer.universe_id].total++;
        if (buyersWithTranscripts.has(buyer.id)) {
          stats[buyer.universe_id].withTranscripts++;
        }
      });
      return stats;
    },
  });
}

export function useDealStatsQuery() {
  return useQuery({
    queryKey: ['remarketing', 'universe-deal-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remarketing_scores')
        .select('universe_id, listing_id')
        .limit(50000);

      if (error) throw error;

      const stats: Record<string, Set<string>> = {};
      data?.forEach((score) => {
        if (!score.universe_id) return;
        if (!stats[score.universe_id]) {
          stats[score.universe_id] = new Set();
        }
        stats[score.universe_id].add(score.listing_id);
      });

      const counts: DealStats = {};
      Object.keys(stats).forEach((key) => {
        counts[key] = stats[key].size;
      });
      return counts;
    },
  });
}

export function useArchivedCountQuery() {
  return useQuery({
    queryKey: ['remarketing', 'archived-universe-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('remarketing_buyer_universes')
        .select('id', { count: 'exact', head: true })
        .eq('archived', true);

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useFlaggedDealsQuery(refetchWhileEnriching: boolean) {
  return useQuery({
    queryKey: ['remarketing', 'universe-build-flagged-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, title, internal_company_name, industry, address_state, universe_build_flagged_at, buyer_universe_label, buyer_universe_description, buyer_universe_generated_at, enriched_at, created_at',
        )
        .eq('universe_build_flagged', true)
        .order('universe_build_flagged_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FlaggedDeal[];
    },
    refetchInterval: refetchWhileEnriching ? 5000 : false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────

export function useCreateUniverseMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from('remarketing_buyer_universes')
        .insert({
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, { name }) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success(`"${name}" has been created.`);
      setSearchParams({});
      navigate(`/admin/buyers/universes/${data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useArchiveUniverseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('remarketing_buyer_universes')
        .update({ archived })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success(archived ? 'Universe archived' : 'Universe restored');
    },
  });
}

export function useDeleteUniverseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteUniverseWithRelated(id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      toast.success('Universe deleted');
    },
  });
}

export function useBulkDeleteUniversesMutation(onClearSelection: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => deleteUniverseWithRelated(id)));
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to delete ${errors.length} universe(s)`);
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['remarketing'] });
      onClearSelection();
      toast.success(`${ids.length} universe(s) deleted`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Flagged deals helpers ──────────────────────────────────────────

export function useFlaggedDealsManager(flaggedDeals: FlaggedDeal[] | undefined) {
  const queryClient = useQueryClient();
  const { startOrQueueMajorOp } = useGlobalGateCheck();
  const { runningOp } = useGlobalActivityQueue();
  const isBulkEnriching = runningOp?.operation_type === 'buyer_universe_generation';

  // Local ordering state for drag-and-drop
  const [localFlaggedOrder, setLocalFlaggedOrder] = useState<FlaggedDeal[]>([]);
  const orderedFlagged = useMemo(() => {
    if (localFlaggedOrder && localFlaggedOrder.length > 0) return localFlaggedOrder;
    return flaggedDeals || [];
  }, [flaggedDeals, localFlaggedOrder]);

  // Keep local order in sync when data changes
  useEffect(() => {
    if (flaggedDeals) setLocalFlaggedOrder(flaggedDeals);
  }, [flaggedDeals]);

  const handleFlaggedDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const current = [...orderedFlagged];
      const oldIdx = current.findIndex((d) => d.id === active.id);
      const newIdx = current.findIndex((d) => d.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(current, oldIdx, newIdx);
      setLocalFlaggedOrder(reordered);

      try {
        await Promise.all(
          reordered.map((deal, idx) =>
            supabase
              .from('listings')
              .update({ universe_build_priority: idx + 1 } as never)
              .eq('id', deal.id),
          ),
        );
        queryClient.invalidateQueries({
          queryKey: ['remarketing', 'universe-build-flagged-deals'],
        });
      } catch {
        toast.error('Failed to save new order');
      }
    },
    [orderedFlagged, queryClient],
  );

  const enrichAllFlaggedDeals = useCallback(async () => {
    const unenriched = orderedFlagged.filter((d) => !d.buyer_universe_generated_at);
    if (unenriched.length === 0) {
      toast.info('All deals already have buyer universe data');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { queued } = await startOrQueueMajorOp({
      operationType: 'buyer_universe_generation',
      totalItems: unenriched.length,
      contextJson: { listing_ids: unenriched.map((d) => d.id) },
      description: `Generate buyer universes for ${unenriched.length} deal${unenriched.length > 1 ? 's' : ''}`,
      userId: user?.id || 'unknown',
    });

    if (queued) {
      return;
    }

    supabase.functions
      .invoke('process-buyer-universe-queue', {
        body: { trigger: 'buyer-universe-generation' },
      })
      .catch((err) => console.warn('Worker trigger failed:', err));

    toast.info(
      `Queued ${unenriched.length} deal${unenriched.length > 1 ? 's' : ''} for buyer universe generation`,
    );
  }, [orderedFlagged, startOrQueueMajorOp]);

  // Deal-level enrichment
  const [isDealEnriching, setIsDealEnriching] = useState(false);

  const handleBulkDealEnrich = useCallback(
    async (mode: 'unenriched' | 'all') => {
      if (!orderedFlagged?.length) return;
      const targets =
        mode === 'unenriched' ? orderedFlagged.filter((d) => !d.enriched_at) : orderedFlagged;
      if (!targets.length) {
        toast.info('No deals to enrich');
        return;
      }
      setIsDealEnriching(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      try {
        await startOrQueueMajorOp({
          operationType: 'deal_enrichment',
          totalItems: targets.length,
          description: `Enriching ${targets.length} flagged deals`,
          userId: user?.id || '',
          contextJson: { source: 'universe_flagged' },
        });
      } catch {
        /* Non-blocking */
      }

      const now = new Date().toISOString();
      const seen = new Set<string>();
      const rows = targets
        .filter((d) => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        })
        .map((d) => ({
          listing_id: d.id,
          status: 'pending' as const,
          attempts: 0,
          queued_at: now,
        }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('enrichment_queue')
          .upsert(chunk, { onConflict: 'listing_id' });
        if (error) {
          toast.error('Failed to queue enrichment');
          setIsDealEnriching(false);
          return;
        }
      }

      toast.success(`Queued ${targets.length} deals for enrichment`);

      supabase.functions
        .invoke('process-enrichment-queue', {
          body: { source: 'universe_flagged_bulk' },
        })
        .catch(() => {});

      setIsDealEnriching(false);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-build-flagged-deals'] });
    },
    [orderedFlagged, startOrQueueMajorOp, queryClient],
  );

  const removeDealFromFlagged = useCallback(
    async (dealId: string) => {
      const { error } = await supabase
        .from('listings')
        .update({ universe_build_flagged: false, universe_build_flagged_at: null })
        .eq('id', dealId);
      if (error) {
        toast.error('Failed to remove deal from list');
      } else {
        toast.success('Deal removed from To Be Created list');
        queryClient.invalidateQueries({
          queryKey: ['remarketing', 'universe-build-flagged-deals'],
        });
      }
    },
    [queryClient],
  );

  return {
    orderedFlagged,
    handleFlaggedDragEnd,
    enrichAllFlaggedDeals,
    isDealEnriching,
    handleBulkDealEnrich,
    isBulkEnriching,
    runningOp,
    removeDealFromFlagged,
  };
}

// ─── Description generation helper ──────────────────────────────────

export function useGenerateDescription(newName: string, setNewDescription: (val: string) => void) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Enter a universe name first');
      return;
    }
    setIsGenerating(true);
    const fallback = `Buyer universe targeting companies in the ${newName.trim()} industry. Includes PE firms, strategic acquirers, and family offices actively seeking acquisitions in this space.`;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `https://vhzipqarkmmfuqadefep.supabase.co/functions/v1/clarify-industry`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            industry_name: newName.trim(),
            generate_description: true,
          }),
        },
      );
      if (response.ok) {
        const result = await response.json();
        setNewDescription(result.description || fallback);
      } else {
        setNewDescription(fallback);
      }
      toast.success('Description generated');
    } catch {
      setNewDescription(fallback);
      toast.success('Description generated');
    } finally {
      setIsGenerating(false);
    }
  }, [newName, setNewDescription]);

  return { isGenerating, generate };
}

// ─── Sorting / filtering logic ──────────────────────────────────────

/** Extract a short industry description from the guide's markdown content */
export function extractGuideDescription(guideContent: string | null | undefined): string | null {
  if (!guideContent) return null;

  const boilerplatePatterns = [
    /^\*?\*?analyst\s*note/i,
    /^here\s+is\s+(the|a)\s+(comprehensive|definitive|foundational|complete)/i,
    /^this\s+document\s+provides/i,
    /^this\s+(guide|report|analysis)\s+(is|provides|covers|presents)/i,
    /^\[uploaded\s+guide/i,
    /^(note|disclaimer|warning)\s*:/i,
  ];

  const lines = guideContent.split('\n');
  for (const line of lines) {
    const trimmed = line
      .trim()
      .replace(/^\*\*+/, '')
      .replace(/\*\*+$/, '')
      .trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('-') ||
      trimmed.length < 40
    )
      continue;
    if (boilerplatePatterns.some((p) => p.test(trimmed))) continue;
    return trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed;
  }
  return null;
}

export function useSortedUniverses(
  universes: ReturnType<typeof useUniversesQuery>['data'],
  search: string,
  sortField: SortField,
  sortOrder: SortOrder,
  buyerStats: BuyerStats | undefined,
  dealStats: DealStats | undefined,
) {
  return useMemo(() => {
    if (!universes) return [];

    const filtered = universes.filter((u) => {
      if (!search) return true;
      return (
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.description?.toLowerCase().includes(search.toLowerCase())
      );
    });

    return filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'buyers':
          aVal = buyerStats?.[a.id]?.total || 0;
          bVal = buyerStats?.[b.id]?.total || 0;
          break;
        case 'deals':
          aVal = dealStats?.[a.id] || 0;
          bVal = dealStats?.[b.id] || 0;
          break;
        case 'coverage': {
          const aStats = buyerStats?.[a.id];
          const bStats = buyerStats?.[b.id];
          const aWebsite = aStats && aStats.total > 0 ? (aStats.enriched / aStats.total) * 50 : 0;
          const aTranscript =
            aStats && aStats.total > 0 ? (aStats.withTranscripts / aStats.total) * 50 : 0;
          const bWebsite = bStats && bStats.total > 0 ? (bStats.enriched / bStats.total) * 50 : 0;
          const bTranscript =
            bStats && bStats.total > 0 ? (bStats.withTranscripts / bStats.total) * 50 : 0;
          aVal = aWebsite + aTranscript;
          bVal = bWebsite + bTranscript;
          break;
        }
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [universes, search, sortField, sortOrder, buyerStats, dealStats]);
}
