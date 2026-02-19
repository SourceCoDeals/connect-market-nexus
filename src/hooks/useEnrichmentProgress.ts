import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DealEnrichmentError {
  listingId: string;
  dealName?: string;
  error: string;
}

export interface DealEnrichmentSummary {
  total: number;
  successful: number;
  failed: number;
  errors: DealEnrichmentError[];
  completedAt: string;
}

interface EnrichmentProgress {
  isEnriching: boolean;
  isPaused: boolean;
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  progress: number;
  estimatedTimeRemaining: string;
  processingRate: number;
  successfulCount: number;
  errors: DealEnrichmentError[];
}

const EMPTY_PROGRESS: EnrichmentProgress = {
  isEnriching: false,
  isPaused: false,
  completedCount: 0,
  totalCount: 0,
  pendingCount: 0,
  processingCount: 0,
  failedCount: 0,
  progress: 0,
  estimatedTimeRemaining: '',
  processingRate: 0,
  successfulCount: 0,
  errors: [],
};

export function useEnrichmentProgress() {
  const [progress, setProgress] = useState<EnrichmentProgress>(EMPTY_PROGRESS);
  const [summary, setSummary] = useState<DealEnrichmentSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const initialCompletedRef = useRef<number>(0);
  const wasRunningRef = useRef(false);
  const lastTotalRef = useRef(0);
  // Debounce realtime events — only fetch once per interval
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef(0);

  const fetchQueueStatus = useCallback(async () => {
    // Throttle: skip if last fetch was < 3 seconds ago
    const now = Date.now();
    if (now - lastFetchRef.current < 3000) return;
    lastFetchRef.current = now;

    try {
      // 8-hour cutoff: at 4-6 items/minute, a 1400-item batch takes ~4-6 hours
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

      // Use lightweight count queries instead of fetching all rows
      const [pendingRes, processingRes, completedRes, failedRes, pausedRes] = await Promise.all([
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending').gte('queued_at', cutoff),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing').gte('queued_at', cutoff),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('queued_at', cutoff),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('queued_at', cutoff),
        supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'paused').gte('queued_at', cutoff),
      ]);

      const counts = {
        pending: pendingRes.count ?? 0,
        processing: processingRes.count ?? 0,
        completed: completedRes.count ?? 0,
        failed: failedRes.count ?? 0,
        paused: pausedRes.count ?? 0,
      };

      // Only fetch error details if there are failed items (and limit to 50)
      let errorItems: DealEnrichmentError[] = [];
      if (counts.failed > 0) {
        const { data: failedData } = await supabase
          .from('enrichment_queue')
          .select('listing_id, last_error')
          .eq('status', 'failed')
          .gte('queued_at', cutoff)
          .not('last_error', 'is', null)
          .limit(50);

        errorItems = (failedData ?? []).map((row) => ({
          listingId: row.listing_id,
          error: row.last_error ?? 'Unknown error',
        }));
      }

      const totalActive = counts.pending + counts.processing;
      const isPaused = counts.paused > 0 && totalActive === 0;
      const totalCount = totalActive + counts.completed + counts.failed + counts.paused;
      const isEnriching = counts.processing > 0 || (counts.pending > 0 && counts.completed > 0);
      const successfulCount = counts.completed;

      // Track timing for rate calculation
      if (isEnriching && !startTimeRef.current) {
        startTimeRef.current = Date.now();
        initialCompletedRef.current = counts.completed;
      } else if (!isEnriching && !isPaused) {
        startTimeRef.current = null;
        initialCompletedRef.current = 0;
      }

      // Calculate processing rate
      let processingRate = 0;
      if (startTimeRef.current && counts.completed > initialCompletedRef.current) {
        const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
        if (elapsedMinutes > 0.1) {
          processingRate = (counts.completed - initialCompletedRef.current) / elapsedMinutes;
        }
      }

      // Calculate estimated time remaining
      let estimatedTimeRemaining = '';
      const remainingItems = totalActive + counts.paused;
      if (processingRate > 0 && remainingItems > 0) {
        const minutesRemaining = remainingItems / processingRate;
        if (minutesRemaining < 1) {
          estimatedTimeRemaining = 'less than 1 min';
        } else if (minutesRemaining < 60) {
          estimatedTimeRemaining = `${Math.ceil(minutesRemaining)} min`;
        } else {
          const hours = Math.floor(minutesRemaining / 60);
          const mins = Math.ceil(minutesRemaining % 60);
          estimatedTimeRemaining = `${hours}h ${mins}m`;
        }
      } else if (remainingItems > 0 && !processingRate) {
        const estimatedMins = Math.ceil(remainingItems / 20);
        estimatedTimeRemaining = estimatedMins < 1 ? 'less than 1 min' : `~${estimatedMins} min`;
      }

      const progressPercent = totalCount > 0 ? (counts.completed / totalCount) * 100 : 0;

      // Detect completion transition
      const justCompleted = wasRunningRef.current && !isEnriching && !isPaused && lastTotalRef.current > 0;

      if (justCompleted) {
        setSummary({
          total: lastTotalRef.current,
          successful: successfulCount,
          failed: counts.failed,
          errors: errorItems,
          completedAt: new Date().toISOString(),
        });
        setShowSummary(true);
      }

      wasRunningRef.current = isEnriching || isPaused;
      if (isEnriching || isPaused) {
        lastTotalRef.current = totalCount;
      }

      setProgress({
        isEnriching,
        isPaused,
        completedCount: successfulCount + counts.failed,
        totalCount,
        pendingCount: counts.pending,
        processingCount: counts.processing,
        failedCount: counts.failed,
        progress: progressPercent,
        estimatedTimeRemaining,
        processingRate,
        successfulCount,
        errors: errorItems,
      });
    } catch (error) {
      console.error('Error fetching enrichment queue status:', error);
    }
  }, []);

  const pauseEnrichment = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ status: 'paused' })
        .eq('status', 'pending');
      if (error) throw error;
      toast({ title: "Enrichment paused", description: "Remaining deals have been paused. In-progress deals will finish." });
      lastFetchRef.current = 0; // Allow immediate fetch
      fetchQueueStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [fetchQueueStatus]);

  const resumeEnrichment = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ status: 'pending' })
        .eq('status', 'paused');
      if (error) throw error;
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'resume' } })
        .catch(console.warn);
      toast({ title: "Enrichment resumed", description: "Remaining deals will continue enriching." });
      lastFetchRef.current = 0;
      fetchQueueStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [fetchQueueStatus]);

  const cancelEnrichment = useCallback(async () => {
    try {
      // Delete all pending, paused, AND processing items
      const { error } = await supabase
        .from('enrichment_queue')
        .delete()
        .in('status', ['pending', 'paused', 'processing']);
      if (error) throw error;

      startTimeRef.current = null;
      initialCompletedRef.current = 0;
      wasRunningRef.current = false;
      lastTotalRef.current = 0;

      // Immediately hide the progress bar
      setProgress(EMPTY_PROGRESS);

      toast({ title: "Enrichment cancelled", description: "Remaining deals have been removed from the queue." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, []);

  const dismissSummary = useCallback(() => {
    setShowSummary(false);
    setSummary(null);
  }, []);

  useEffect(() => {
    fetchQueueStatus();

    const channel = supabase
      .channel('enrichment-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_queue',
        },
        () => {
          // Debounce realtime events — batch rapid changes into one fetch
          if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = setTimeout(() => {
            lastFetchRef.current = 0; // Reset throttle for this debounced call
            fetchQueueStatus();
          }, 2000);
        }
      )
      .subscribe();

    // Poll every 10 seconds instead of 5
    const interval = setInterval(fetchQueueStatus, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [fetchQueueStatus]);

  return {
    progress,
    summary,
    showSummary,
    dismissSummary,
    pauseEnrichment,
    resumeEnrichment,
    cancelEnrichment,
  };
}
