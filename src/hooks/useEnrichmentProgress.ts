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

export function useEnrichmentProgress() {
  const [progress, setProgress] = useState<EnrichmentProgress>({
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
  });
  
  const [summary, setSummary] = useState<DealEnrichmentSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Track timing for rate calculation
  const startTimeRef = useRef<number | null>(null);
  const initialCompletedRef = useRef<number>(0);
  const wasRunningRef = useRef(false);
  const lastTotalRef = useRef(0);

  const fetchQueueStatus = useCallback(async () => {
    try {
      // Only consider queue items from the last 2 hours as "active"
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('status, listing_id, last_error, queued_at')
        .in('status', ['pending', 'processing', 'completed', 'failed', 'paused'])
        .gte('queued_at', cutoff);

      if (error) throw error;

      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      };
      
      const errorItems: DealEnrichmentError[] = [];

      data?.forEach((row) => {
        const status = row.status as keyof typeof counts;
        if (counts[status] !== undefined) {
          counts[status]++;
        }
        if (row.status === 'failed' && row.last_error) {
          errorItems.push({
            listingId: row.listing_id,
            error: row.last_error,
          });
        }
      });

      const totalActive = counts.pending + counts.processing;
      const isPaused = counts.paused > 0 && totalActive === 0;
      const totalCount = totalActive + counts.completed + counts.failed + counts.paused;
      // Only show enrichment bar if something is actively processing or was recently queued
      // Stale detection: if there are pending items but nothing is processing for a while, treat as stale
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
          const completedSinceStart = counts.completed - initialCompletedRef.current;
          processingRate = completedSinceStart / elapsedMinutes;
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
      // Set all pending items to paused
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ status: 'paused' })
        .eq('status', 'pending');

      if (error) throw error;
      toast({ title: "Enrichment paused", description: "Remaining deals have been paused. In-progress deals will finish." });
      fetchQueueStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [fetchQueueStatus]);

  const resumeEnrichment = useCallback(async () => {
    try {
      // Set all paused items back to pending
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ status: 'pending' })
        .eq('status', 'paused');

      if (error) throw error;
      
      // Trigger the worker
      void supabase.functions
        .invoke('process-enrichment-queue', { body: { source: 'resume' } })
        .catch(console.warn);
      
      toast({ title: "Enrichment resumed", description: "Remaining deals will continue enriching." });
      fetchQueueStatus();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [fetchQueueStatus]);

  const cancelEnrichment = useCallback(async () => {
    try {
      // Delete all pending and paused items from queue
      const { error } = await supabase
        .from('enrichment_queue')
        .delete()
        .in('status', ['pending', 'paused']);

      if (error) throw error;
      
      startTimeRef.current = null;
      initialCompletedRef.current = 0;
      wasRunningRef.current = false;
      lastTotalRef.current = 0;
      
      // Immediately hide the progress bar
      setProgress(prev => ({
        ...prev,
        isEnriching: false,
        isPaused: false,
        pendingCount: 0,
        processingCount: 0,
      }));
      
      toast({ title: "Enrichment cancelled", description: "Remaining deals have been removed from the queue. Already completed deals are kept." });
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
          fetchQueueStatus();
        }
      )
      .subscribe();

    const interval = setInterval(fetchQueueStatus, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
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
