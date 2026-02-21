import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithTimeout } from '@/lib/invoke-with-timeout';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface DealEnrichmentStatus {
  dealId: string;
  status: 'pending' | 'enriching' | 'success' | 'error' | 'skipped';
  error?: string;
  errorCode?: string;
}

export interface DealEnrichmentProgress {
  current: number;
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  statuses: Map<string, DealEnrichmentStatus>;
  isRunning: boolean;
  isCancelled: boolean;
  creditsDepleted: boolean;
}

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 1500;

export function useDealEnrichment(universeId?: string) {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  
  const [progress, setProgress] = useState<DealEnrichmentProgress>({
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    statuses: new Map(),
    isRunning: false,
    isCancelled: false,
    creditsDepleted: false,
  });

  const updateStatus = useCallback((dealId: string, status: DealEnrichmentStatus) => {
    setProgress(prev => {
      const newStatuses = new Map(prev.statuses);
      newStatuses.set(dealId, status);
      return { ...prev, statuses: newStatuses };
    });
  }, []);

  const enrichDeals = useCallback(async (
    deals: Array<{ id: string; listingId: string; enrichedAt?: string | null; hasWebsite?: boolean }>
  ) => {
    const enrichableDeals = deals.filter(d => d.listingId);

    if (enrichableDeals.length === 0) {
      toast.info('No deals to enrich');
      return;
    }

    cancelledRef.current = false;

    setProgress({
      current: 0,
      total: enrichableDeals.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      statuses: new Map(),
      isRunning: true,
      isCancelled: false,
      creditsDepleted: false,
    });

    try {
      const { queueDealEnrichment } = await import("@/lib/remarketing/queueEnrichment");
      const queued = await queueDealEnrichment(enrichableDeals.map(d => d.listingId));

      // Don't set isRunning to false — the queue-based progress hook
      // (useEnrichmentProgress) tracks actual completion from the enrichment_queue table.
      setProgress(prev => ({
        ...prev,
        current: queued,
        total: enrichableDeals.length,
        successful: queued,
        isRunning: false,
      }));

      if (universeId) {
        queryClient.invalidateQueries({ queryKey: ['remarketing', 'universe-deals', universeId] });
      }

      return { successful: queued, failed: 0, skipped: 0, creditsDepleted: false };
    } catch (error) {
      console.error('Failed to queue deal enrichment:', error);
      toast.error('Failed to queue enrichment');
      setProgress(prev => ({ ...prev, isRunning: false }));
      return { successful: 0, failed: enrichableDeals.length, skipped: 0, creditsDepleted: false };
    }
  }, [queryClient, universeId]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setProgress({
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      statuses: new Map(),
      isRunning: false,
      isCancelled: false,
      creditsDepleted: false,
    });
  }, []);

  return {
    progress,
    enrichDeals,
    cancel,
    reset,
  };
}
