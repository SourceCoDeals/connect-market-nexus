import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      // Get counts by status
      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('status, listing_id, last_error')
        .in('status', ['pending', 'processing', 'completed', 'failed']);

      if (error) throw error;

      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      
      const errorItems: DealEnrichmentError[] = [];

      data?.forEach((row) => {
        const status = row.status as keyof typeof counts;
        if (counts[status] !== undefined) {
          counts[status]++;
        }
        // Collect error details for failed items
        if (row.status === 'failed' && row.last_error) {
          errorItems.push({
            listingId: row.listing_id,
            error: row.last_error,
          });
        }
      });

      const totalActive = counts.pending + counts.processing;
      const totalCount = totalActive + counts.completed;
      const isEnriching = totalActive > 0;
      const successfulCount = counts.completed;

      // Track timing for rate calculation
      if (isEnriching && !startTimeRef.current) {
        startTimeRef.current = Date.now();
        initialCompletedRef.current = counts.completed;
      } else if (!isEnriching) {
        startTimeRef.current = null;
        initialCompletedRef.current = 0;
      }

      // Calculate processing rate (deals per minute)
      let processingRate = 0;
      if (startTimeRef.current && counts.completed > initialCompletedRef.current) {
        const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
        if (elapsedMinutes > 0.1) { // Wait at least 6 seconds before calculating rate
          const completedSinceStart = counts.completed - initialCompletedRef.current;
          processingRate = completedSinceStart / elapsedMinutes;
        }
      }

      // Calculate estimated time remaining
      let estimatedTimeRemaining = '';
      if (processingRate > 0 && totalActive > 0) {
        const minutesRemaining = totalActive / processingRate;
        if (minutesRemaining < 1) {
          estimatedTimeRemaining = 'less than 1 min';
        } else if (minutesRemaining < 60) {
          estimatedTimeRemaining = `${Math.ceil(minutesRemaining)} min`;
        } else {
          const hours = Math.floor(minutesRemaining / 60);
          const mins = Math.ceil(minutesRemaining % 60);
          estimatedTimeRemaining = `${hours}h ${mins}m`;
        }
      } else if (totalActive > 0 && !processingRate) {
        // Use historical rate of ~20 deals/min based on memory
        const estimatedMins = Math.ceil(totalActive / 20);
        estimatedTimeRemaining = estimatedMins < 1 ? 'less than 1 min' : `~${estimatedMins} min`;
      }

      const progressPercent = totalCount > 0 ? (counts.completed / totalCount) * 100 : 0;
      
      // Detect completion transition (was running, now stopped)
      const justCompleted = wasRunningRef.current && !isEnriching && lastTotalRef.current > 0;
      
      if (justCompleted) {
        // Generate summary from final state
        setSummary({
          total: lastTotalRef.current,
          successful: successfulCount,
          failed: counts.failed,
          errors: errorItems,
          completedAt: new Date().toISOString(),
        });
        setShowSummary(true);
      }
      
      // Update tracking refs
      wasRunningRef.current = isEnriching;
      if (isEnriching) {
        lastTotalRef.current = totalCount;
      }

      setProgress({
        isEnriching,
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
  
  const dismissSummary = useCallback(() => {
    setShowSummary(false);
    setSummary(null);
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchQueueStatus();

    // Subscribe to changes on enrichment_queue
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

    // Also poll every 5 seconds as a fallback
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
  };
}
